import { invoke } from "@tauri-apps/api/core"

/**
 * "내 단골 명령" — 자주 쓰는 자반/줄임말/틱커 한 줄을 이 PC 에 모아둔다.
 *
 * ★새 서버 API 를 만들지 않는다★
 *   Rust 쪽에 이미 등록돼 있으면서 아무도 안 쓰던 textsnips_load/save
 *   (앱 설정폴더 text_snippets.json) 를 그대로 재활용한다. 저장 루틴은
 *   favorites 와 공용이라 JSON 검사 + .bak 백업 + 임시파일 rename 까지
 *   이미 되어 있다.
 *
 * 즐겨찾기(favorites)와 달리 PC 간 공유가 필요한 데이터가 아니라서
 * 서버로 올리지 않는다 — 사람마다 자주 쓰는 문구가 다르다.
 */

export interface MySnip {
  id: string
  label: string
  /** tin 파일에 그대로 들어갈 한 줄 (또는 여러 줄) */
  text: string
}

export interface MySnipStore {
  version: 1
  items: MySnip[]
}

export const EMPTY_SNIPS: MySnipStore = { version: 1, items: [] }

export function newSnipId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 저장된 문자열을 해석한다. 깨져 있어도 절대 던지지 않는다 —
 * 읽기 실패로 화면이 통째로 죽는 것보다 빈 목록으로 시작하는 게 낫다.
 *
 * text_snippets.json 은 예전 "양식 즐겨찾기"가 쓰던 자리라 다른 모양의
 * 데이터가 남아 있을 수 있다. 살릴 수 있는 항목만 건져낸다.
 */
export function parseSnips(raw: string): MySnipStore {
  if (!raw || !raw.trim()) return EMPTY_SNIPS

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return EMPTY_SNIPS
  }
  if (typeof data !== "object" || data === null) return EMPTY_SNIPS

  const arr = (data as Record<string, unknown>).items
  if (!Array.isArray(arr)) return EMPTY_SNIPS

  const items: MySnip[] = []
  for (const it of arr) {
    if (typeof it !== "object" || it === null) continue
    const o = it as Record<string, unknown>
    const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : "")
    // 옛 양식 즐겨찾기는 본문 키 이름이 달랐을 수 있다 — 순서대로 찾아본다
    const text = str("text") || str("body") || str("command") || str("snippet")
    if (!text) continue
    items.push({
      id: str("id") || newSnipId(),
      label: str("label") || str("name") || text.slice(0, 20),
      text,
    })
  }
  return { version: 1, items }
}

export function validSnipLabel(label: string): string | null {
  const l = (label ?? "").trim()
  if (!l) return "이름을 입력해 주세요."
  if (l.length > 40) return "이름이 너무 깁니다 (최대 40자)."
  return null
}

export function validSnipText(text: string): string | null {
  const t = (text ?? "").trim()
  if (!t) return "저장할 명령을 입력해 주세요."
  if (t.length > 2000) return "명령이 너무 깁니다 (최대 2000자)."
  return null
}

export function upsertSnip(s: MySnipStore, snip: MySnip): MySnipStore {
  const i = s.items.findIndex((x) => x.id === snip.id)
  return {
    ...s,
    items: i === -1 ? [...s.items, snip] : s.items.map((x) => (x.id === snip.id ? snip : x)),
  }
}

export function removeSnip(s: MySnipStore, id: string): MySnipStore {
  return { ...s, items: s.items.filter((x) => x.id !== id) }
}

export async function loadSnips(): Promise<MySnipStore> {
  try {
    return parseSnips(await invoke<string>("textsnips_load"))
  } catch {
    // 데스크톱 앱이 아니면(브라우저 미리보기 등) 저장소가 없다 — 정상
    return EMPTY_SNIPS
  }
}

export async function saveSnips(s: MySnipStore): Promise<void> {
  await invoke<string>("textsnips_save", { json: JSON.stringify(s, null, 2) })
}
