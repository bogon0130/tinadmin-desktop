/**
 * 접속 즐겨찾기 — 자료구조와 트리 조작.
 *
 * 저장은 앱 설정폴더의 favorites.json (Rust favorites_load/save).
 * 이 파일에는 화면과 무관한 순수 함수만 둔다 — 그래야 테스트할 수 있다.
 *
 * ★서버 IP/계정은 저장하지 않는다★
 *   접속 순간에 서버 config(.env)에서 받아온다. 여기 박아두면 서버 주소가
 *   바뀔 때 저장된 항목이 전부 낡은 값이 된다.
 */
import { invoke } from "@tauri-apps/api/core"

export type ConnectMode = "solo" | "group"
export type SessionMode = "file" | "builder"

export interface Favorite {
  id: string
  name: string
  /** 조합 파일 이름(확장자 없음). tin/_combos/<combo>.tin */
  combo: string
  /** #read 순서 그대로 */
  files: string[]
  session: string
  host: string
  port: string
  sessionMode: SessionMode
  /** 저장 시점에 고정한 접속 방식 */
  mode: ConnectMode
  /** 소속 폴더. "" 면 최상위. "a/b" 처럼 하위 분류 가능 */
  folder: string
  createdAt: string
}

export interface FavStore {
  version: 1
  folders: string[]
  items: Favorite[]
}

export const EMPTY_STORE: FavStore = { version: 1, folders: [], items: [] }

export const MAX_FOLDER_DEPTH = 3

/** 폴더/즐겨찾기 이름 규칙 — 경로에 쓰이므로 tin 파일과 같은 화이트리스트를 쓴다. */
const NAME_RE = /^[가-힣a-zA-Z0-9_\- ]{1,30}$/

export function validName(n: string): string | null {
  const s = n.trim()
  if (!s) return "이름을 입력해 주세요."
  if (!NAME_RE.test(s))
    return "이름에는 한글·영문·숫자·공백·_·- 만 쓸 수 있습니다 (1~30자)."
  return null
}

export function newId(): string {
  return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/* ------------------------------------------------------------------ */
/* 읽기 — 깨진 파일에도 절대 죽지 않는다                                 */
/* ------------------------------------------------------------------ */

/**
 * 저장된 문자열을 FavStore 로 해석한다.
 *
 * 요구사항: 읽기 실패 시 빈 목록으로 초기화하고 경고를 띄운다.
 * 그래서 예외를 던지지 않고 { store, warning } 을 돌려준다.
 * 항목 하나가 깨졌다고 전체를 버리지 않고, 살릴 수 있는 것만 살린다.
 */
export function parseStore(raw: string): { store: FavStore; warning: string | null } {
  if (!raw || !raw.trim()) return { store: EMPTY_STORE, warning: null }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return {
      store: EMPTY_STORE,
      warning: "즐겨찾기 파일을 읽을 수 없어 빈 목록으로 시작합니다 (원본은 .bak 로 남아 있습니다).",
    }
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { store: EMPTY_STORE, warning: "즐겨찾기 파일 형식이 올바르지 않아 빈 목록으로 시작합니다." }
  }

  const o = data as Record<string, unknown>
  const rawItems = Array.isArray(o.items) ? o.items : []
  const rawFolders = Array.isArray(o.folders) ? o.folders : []

  const items: Favorite[] = []
  let dropped = 0
  for (const it of rawItems) {
    const f = toFavorite(it)
    if (f) items.push(f)
    else dropped++
  }

  const folders = rawFolders
    .filter((f): f is string => typeof f === "string")
    .map((f) => normFolder(f))
    .filter((f) => f !== "")

  // 항목이 가리키는 폴더가 목록에 없으면 채워 넣는다 (고아 항목 방지)
  const all = new Set(folders)
  for (const it of items) {
    if (it.folder) for (const p of ancestors(it.folder)) all.add(p)
  }

  return {
    store: { version: 1, folders: [...all].sort(), items },
    warning: dropped > 0 ? `즐겨찾기 ${dropped}개가 손상되어 제외했습니다.` : null,
  }
}

function toFavorite(v: unknown): Favorite | null {
  if (typeof v !== "object" || v === null) return null
  const o = v as Record<string, unknown>
  const str = (k: string, d = "") => (typeof o[k] === "string" ? (o[k] as string) : d)
  const name = str("name")
  const combo = str("combo")
  if (!name || !combo) return null
  const files = Array.isArray(o.files) ? o.files.filter((x): x is string => typeof x === "string") : []
  if (files.length === 0) return null
  const mode: ConnectMode = str("mode") === "group" ? "group" : "solo"
  const sessionMode: SessionMode = str("sessionMode") === "builder" ? "builder" : "file"
  return {
    id: str("id") || newId(),
    name,
    combo,
    files,
    session: str("session"),
    host: str("host"),
    port: str("port"),
    sessionMode,
    mode,
    folder: normFolder(str("folder")),
    createdAt: str("createdAt"),
  }
}

/* ------------------------------------------------------------------ */
/* 폴더 경로                                                           */
/* ------------------------------------------------------------------ */

/** 앞뒤 슬래시·중복 슬래시·빈 조각을 정리한다. */
export function normFolder(p: string): string {
  return (p || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_FOLDER_DEPTH)
    .join("/")
}

/** "a/b/c" -> ["a", "a/b", "a/b/c"] */
export function ancestors(p: string): string[] {
  const segs = normFolder(p).split("/").filter(Boolean)
  return segs.map((_, i) => segs.slice(0, i + 1).join("/"))
}

export function folderDepth(p: string): number {
  return normFolder(p) ? normFolder(p).split("/").length : 0
}

/* ------------------------------------------------------------------ */
/* 트리 조작 — 전부 새 객체를 돌려준다 (원본 불변)                        */
/* ------------------------------------------------------------------ */

export function addFolder(s: FavStore, parent: string, name: string): FavStore | string {
  const bad = validName(name)
  if (bad) return bad
  const path = normFolder(parent ? `${parent}/${name.trim()}` : name.trim())
  if (folderDepth(path) > MAX_FOLDER_DEPTH) return `폴더는 최대 ${MAX_FOLDER_DEPTH}단계까지입니다.`
  if (s.folders.includes(path)) return "같은 이름의 폴더가 이미 있습니다."
  return { ...s, folders: [...s.folders, path].sort() }
}

export function renameFolder(s: FavStore, path: string, name: string): FavStore | string {
  const bad = validName(name)
  if (bad) return bad
  const from = normFolder(path)
  if (!s.folders.includes(from)) return "폴더를 찾을 수 없습니다."
  const parent = from.split("/").slice(0, -1).join("/")
  const to = normFolder(parent ? `${parent}/${name.trim()}` : name.trim())
  if (to === from) return s
  if (s.folders.includes(to)) return "같은 이름의 폴더가 이미 있습니다."

  const swap = (p: string) => (p === from || p.startsWith(from + "/") ? to + p.slice(from.length) : p)
  return {
    ...s,
    folders: s.folders.map(swap).sort(),
    items: s.items.map((it) => ({ ...it, folder: swap(it.folder) })),
  }
}

/**
 * 폴더를 지운다. 안에 있던 항목과 하위 폴더는 상위로 올린다 (삭제하지 않는다).
 * 즐겨찾기를 실수로 통째로 날리는 것보다 안전하다.
 */
export function deleteFolder(s: FavStore, path: string): FavStore {
  const from = normFolder(path)
  const parent = from.split("/").slice(0, -1).join("/")
  const inside = (p: string) => p === from || p.startsWith(from + "/")
  const lift = (p: string) => {
    if (!inside(p)) return p
    const rest = p.slice(from.length).replace(/^\//, "")
    return normFolder(parent && rest ? `${parent}/${rest}` : parent || rest)
  }
  return {
    folders: [...new Set(s.folders.filter((f) => f !== from).map(lift))].filter(Boolean).sort(),
    items: s.items.map((it) => (inside(it.folder) ? { ...it, folder: lift(it.folder) } : it)),
    version: 1,
  }
}

export function moveItem(s: FavStore, id: string, folder: string): FavStore {
  const to = normFolder(folder)
  return { ...s, items: s.items.map((it) => (it.id === id ? { ...it, folder: to } : it)) }
}

export function upsertItem(s: FavStore, fav: Favorite): FavStore {
  const i = s.items.findIndex((x) => x.id === fav.id)
  const items = i === -1 ? [...s.items, fav] : s.items.map((x) => (x.id === fav.id ? fav : x))
  const folders = [...new Set([...s.folders, ...ancestors(fav.folder)])].filter(Boolean).sort()
  return { version: 1, folders, items }
}

export function removeItem(s: FavStore, id: string): FavStore {
  return { ...s, items: s.items.filter((x) => x.id !== id) }
}

/** 폴더 -> 그 폴더에 직접 속한 항목들 */
export function itemsByFolder(s: FavStore): Map<string, Favorite[]> {
  const m = new Map<string, Favorite[]>()
  for (const it of s.items) {
    const k = normFolder(it.folder)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(it)
  }
  for (const v of m.values()) v.sort((a, b) => a.name.localeCompare(b.name, "ko"))
  return m
}

/** 화면에 그릴 폴더 목록 (조상 폴더까지 포함해 정렬) */
export function allFolders(s: FavStore): string[] {
  const set = new Set<string>()
  for (const f of s.folders) for (const p of ancestors(f)) set.add(p)
  for (const it of s.items) for (const p of ancestors(it.folder)) set.add(p)
  return [...set].sort((a, b) => a.localeCompare(b, "ko"))
}

/* ------------------------------------------------------------------ */
/* 저장소 입출력                                                        */
/* ------------------------------------------------------------------ */

export async function loadFavorites(): Promise<{ store: FavStore; warning: string | null }> {
  const raw = await invoke<string>("favorites_load")
  return parseStore(raw)
}

export async function saveFavorites(s: FavStore): Promise<string> {
  return invoke<string>("favorites_save", { json: JSON.stringify(s, null, 2) })
}

export async function favoritesPath(): Promise<string> {
  return invoke<string>("favorites_path")
}
