import { invoke } from "@tauri-apps/api/core"

/**
 * 명령 즐겨찾기 — 자주 쓰는 줄임말/명령을 살아있는 창에 바로 보낸다.
 *
 * ★접속 즐겨찾기(favorites.ts)와 다르다★
 *   접속 즐겨찾기 : 조합 tin 으로 "새로 접속" 한다.
 *   명령 즐겨찾기 : 이미 떠 있는 창에 "명령 한 줄" 을 넣는다 (#read 아님).
 *   저장 파일도 따로 쓴다 (quick_commands.json).
 *
 * 대상 창은 항목마다 고정해서 저장한다. 클릭 한 번에 나가는 기능이라
 * 그때그때 고르게 하면 잘못된 창으로 보낼 위험이 크기 때문이다.
 * 대신 편집으로 언제든 바꿀 수 있다.
 */

export interface QuickCmd {
  id: string
  label: string
  /** 창에 그대로 들어갈 명령 한 줄 */
  command: string
  session: string
  window: string
}

export interface QuickStore {
  version: 1
  items: QuickCmd[]
}

export const EMPTY_QUICK: QuickStore = { version: 1, items: [] }

export function newQuickId(): string {
  return `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** 명령 한 줄로 쓸 수 있는지 — 서버 검증과 같은 기준 */
export function validCommand(cmd: string): string | null {
  const c = (cmd ?? "").trim()
  if (!c) return "보낼 명령을 입력해 주세요."
  if (c.length > 500) return "명령이 너무 깁니다 (최대 500자)."
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(c)) return "줄바꿈이나 제어문자는 쓸 수 없습니다."
  return null
}

export function validLabel(label: string): string | null {
  const l = (label ?? "").trim()
  if (!l) return "이름을 입력해 주세요."
  if (l.length > 40) return "이름이 너무 깁니다 (최대 40자)."
  return null
}

/**
 * 저장된 문자열을 QuickStore 로 해석한다.
 * 깨져 있어도 절대 예외를 던지지 않고, 살릴 수 있는 항목만 살린다.
 */
export function parseQuick(raw: string): { store: QuickStore; warning: string | null } {
  if (!raw || !raw.trim()) return { store: EMPTY_QUICK, warning: null }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return {
      store: EMPTY_QUICK,
      warning: "명령 즐겨찾기 파일을 읽을 수 없어 빈 목록으로 시작합니다 (원본은 .bak 로 남아 있습니다).",
    }
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { store: EMPTY_QUICK, warning: "명령 즐겨찾기 형식이 올바르지 않아 빈 목록으로 시작합니다." }
  }

  const rawItems = Array.isArray((data as Record<string, unknown>).items)
    ? ((data as Record<string, unknown>).items as unknown[])
    : []

  const items: QuickCmd[] = []
  let dropped = 0
  for (const it of rawItems) {
    if (typeof it !== "object" || it === null) {
      dropped++
      continue
    }
    const o = it as Record<string, unknown>
    const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "")
    const label = str("label")
    const command = str("command")
    const session = str("session")
    const window = str("window")
    if (!label || !command || !session || !window) {
      dropped++
      continue
    }
    items.push({ id: str("id") || newQuickId(), label, command, session, window })
  }

  return {
    store: { version: 1, items },
    warning: dropped > 0 ? `명령 즐겨찾기 ${dropped}개가 손상되어 제외했습니다.` : null,
  }
}

export function upsertQuick(s: QuickStore, item: QuickCmd): QuickStore {
  const i = s.items.findIndex((x) => x.id === item.id)
  return {
    version: 1,
    items: i === -1 ? [...s.items, item] : s.items.map((x) => (x.id === item.id ? item : x)),
  }
}

export function removeQuick(s: QuickStore, id: string): QuickStore {
  return { version: 1, items: s.items.filter((x) => x.id !== id) }
}

/* ---- 저장소 입출력 ---- */

export async function loadQuick(): Promise<{ store: QuickStore; warning: string | null }> {
  const raw = await invoke<string>("quickcmds_load")
  return parseQuick(raw)
}

export async function saveQuick(s: QuickStore): Promise<string> {
  return invoke<string>("quickcmds_save", { json: JSON.stringify(s, null, 2) })
}
