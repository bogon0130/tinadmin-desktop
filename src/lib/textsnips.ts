import { invoke } from "@tauri-apps/api/core"

/**
 * 양식 즐겨찾기 — 자주 쓰는 tin 줄을 저장해두고 편집 중인 파일에 끼워 넣는다.
 *
 * ★게임에 보내지 않는다★
 *   명령 즐겨찾기(quickcmds.ts) : 살아있는 창에 명령을 전송한다.
 *   양식 즐겨찾기(이 파일)      : 지금 열어둔 tin 파일에 텍스트를 삽입만 한다.
 *   tmux 를 전혀 건드리지 않으므로 사냥 중인 세션에 영향이 없다.
 *
 * 저장 파일도 따로 쓴다 (text_snippets.json).
 */

export interface TextSnip {
  id: string
  label: string
  /** 파일에 그대로 들어갈 텍스트 (여러 줄 가능) */
  text: string
}

export interface SnipStore {
  version: 1
  items: TextSnip[]
}

export const EMPTY_SNIPS: SnipStore = { version: 1, items: [] }

export function newSnipId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function validSnipLabel(label: string): string | null {
  const l = (label ?? "").trim()
  if (!l) return "이름을 입력해 주세요."
  if (l.length > 40) return "이름이 너무 깁니다 (최대 40자)."
  return null
}

/**
 * 삽입할 텍스트 검증.
 *
 * 명령 즐겨찾기와 달리 줄바꿈을 허용한다 — 여러 줄짜리 #action 을 통째로
 * 넣는 게 이 기능의 주 용도다. 대신 중괄호 짝은 확인해서, 짝이 안 맞는
 * 조각을 넣어 파일 저장이 막히는 일을 미리 잡아준다.
 */
export function validSnipText(text: string): string | null {
  const t = (text ?? "").trim()
  if (!t) return "삽입할 텍스트를 입력해 주세요."
  if (t.length > 4000) return "텍스트가 너무 깁니다 (최대 4000자)."
  let n = 0
  for (const ch of t) {
    if (ch === "{") n++
    else if (ch === "}") n--
    if (n < 0) return "닫는 중괄호 } 가 여는 것보다 많습니다."
  }
  if (n !== 0) return `중괄호 짝이 맞지 않습니다 (${n}개 안 닫힘).`
  return null
}

/** 저장된 문자열 해석 — 깨져 있어도 예외를 던지지 않는다. */
export function parseSnips(raw: string): { store: SnipStore; warning: string | null } {
  if (!raw || !raw.trim()) return { store: EMPTY_SNIPS, warning: null }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return {
      store: EMPTY_SNIPS,
      warning: "양식 즐겨찾기 파일을 읽을 수 없어 빈 목록으로 시작합니다 (원본은 .bak 로 남아 있습니다).",
    }
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { store: EMPTY_SNIPS, warning: "양식 즐겨찾기 형식이 올바르지 않아 빈 목록으로 시작합니다." }
  }

  const rawItems = Array.isArray((data as Record<string, unknown>).items)
    ? ((data as Record<string, unknown>).items as unknown[])
    : []

  const items: TextSnip[] = []
  let dropped = 0
  for (const it of rawItems) {
    if (typeof it !== "object" || it === null) {
      dropped++
      continue
    }
    const o = it as Record<string, unknown>
    const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "")
    const label = str("label")
    const text = str("text")
    if (!label || !text) {
      dropped++
      continue
    }
    items.push({ id: str("id") || newSnipId(), label, text })
  }

  return {
    store: { version: 1, items },
    warning: dropped > 0 ? `양식 즐겨찾기 ${dropped}개가 손상되어 제외했습니다.` : null,
  }
}

export function upsertSnip(s: SnipStore, item: TextSnip): SnipStore {
  const i = s.items.findIndex((x) => x.id === item.id)
  return {
    version: 1,
    items: i === -1 ? [...s.items, item] : s.items.map((x) => (x.id === item.id ? item : x)),
  }
}

export function removeSnip(s: SnipStore, id: string): SnipStore {
  return { version: 1, items: s.items.filter((x) => x.id !== id) }
}

/* ---- 저장소 입출력 ---- */

export async function loadSnips(): Promise<{ store: SnipStore; warning: string | null }> {
  const raw = await invoke<string>("textsnips_load")
  return parseSnips(raw)
}

export async function saveSnips(s: SnipStore): Promise<string> {
  return invoke<string>("textsnips_save", { json: JSON.stringify(s, null, 2) })
}
