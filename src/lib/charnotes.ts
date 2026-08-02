import { invoke } from "@tauri-apps/api/core"

/**
 * 메모/할일 저장소 — 캐릭터별과 그룹별 두 가지.
 *
 * 이름을 키로 자유 텍스트를 저장한다.
 *   캐릭터 메모 : char_notes.json  (키 = 캐릭터 이름)
 *   그룹 메모   : group_notes.json (키 = 그룹 이름)
 * 자료 구조가 똑같아서 파싱·수정 함수를 공유하고 저장 파일만 나눈다.
 * 서버가 아니라 이 PC 에 둔다 — "이 캐릭 뭘 고쳐야 하더라" 같은 개인 메모라
 * 서버 설정과 성격이 다르고, 서버를 건드리지 않아야 안전하다.
 *
 * 이름이 바뀌면 메모는 따라가지 않는다(옛 이름으로 남는다).
 * 지우지는 않으므로 이름을 되돌리면 다시 보인다.
 */

export interface NoteStore {
  version: 1
  /** 캐릭터 이름 -> 메모 */
  notes: Record<string, string>
}

export const EMPTY_NOTES: NoteStore = { version: 1, notes: {} }

export const MAX_NOTE = 4000

export function validNote(text: string): string | null {
  if ((text ?? "").length > MAX_NOTE) return `메모가 너무 깁니다 (최대 ${MAX_NOTE}자).`
  return null
}

/** 저장된 문자열 해석 — 깨져 있어도 예외를 던지지 않는다. */
export function parseNotes(raw: string): { store: NoteStore; warning: string | null } {
  if (!raw || !raw.trim()) return { store: EMPTY_NOTES, warning: null }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return {
      store: EMPTY_NOTES,
      warning: "캐릭터 메모 파일을 읽을 수 없어 빈 목록으로 시작합니다 (원본은 .bak 로 남아 있습니다).",
    }
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { store: EMPTY_NOTES, warning: "캐릭터 메모 형식이 올바르지 않아 빈 목록으로 시작합니다." }
  }

  const rawNotes = (data as Record<string, unknown>).notes
  const notes: Record<string, string> = {}
  let dropped = 0
  if (typeof rawNotes === "object" && rawNotes !== null && !Array.isArray(rawNotes)) {
    for (const [k, v] of Object.entries(rawNotes as Record<string, unknown>)) {
      if (typeof k === "string" && k && typeof v === "string") notes[k] = v.slice(0, MAX_NOTE)
      else dropped++
    }
  }

  return {
    store: { version: 1, notes },
    warning: dropped > 0 ? `캐릭터 메모 ${dropped}개가 손상되어 제외했습니다.` : null,
  }
}

export function setNote(s: NoteStore, name: string, text: string): NoteStore {
  const notes = { ...s.notes }
  const t = text.trim()
  if (t) notes[name] = t
  else delete notes[name] // 빈 메모는 지운다 (파일이 쓸데없이 커지지 않게)
  return { version: 1, notes }
}

export function getNote(s: NoteStore, name: string): string {
  return s.notes[name] ?? ""
}

/* ---- 저장소 입출력 ---- */

export async function loadNotes(): Promise<{ store: NoteStore; warning: string | null }> {
  const raw = await invoke<string>("charnotes_load")
  return parseNotes(raw)
}

export async function saveNotes(s: NoteStore): Promise<string> {
  return invoke<string>("charnotes_save", { json: JSON.stringify(s, null, 2) })
}

/* ---- 그룹 메모 (같은 구조, 다른 파일) ---- */

export async function loadGroupNotes(): Promise<{ store: NoteStore; warning: string | null }> {
  const raw = await invoke<string>("groupnotes_load")
  return parseNotes(raw)
}

export async function saveGroupNotes(s: NoteStore): Promise<string> {
  return invoke<string>("groupnotes_save", { json: JSON.stringify(s, null, 2) })
}
