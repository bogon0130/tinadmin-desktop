import { getApiUrl, getToken } from "./api"

/**
 * key 별 메모 (GET/POST /api/notes/<key>) — 그룹 대시보드의 캐릭터/그룹 메모칸.
 *
 * ★기존 /api/notes(통짜 정보 저장소, NotesView)와 다른 라우트다★
 *   그건 lib/api.ts 의 getNotes/saveNotes 가 이미 쓰고 있고 파일 하나뿐이다.
 *   여기는 key 마다 별도 파일(features/notes_store/<key>.txt)이라 새 함수로
 *   나눴다. lib/api.ts 를 고치지 않으려고 favstats.ts/groups.ts 와 같은
 *   방식으로 따로 뒀다 — 주소·토큰만 그쪽 함수를 빌려 쓴다.
 *
 * 실패해도 던지지 않는다 — 메모칸 하나 때문에 카드 전체가 죽으면 안 된다.
 */

async function authHeaders(): Promise<Record<string, string>> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function getNote(key: string): Promise<string> {
  try {
    const res = await fetch(`${getApiUrl()}/api/notes/${encodeURIComponent(key)}`, {
      headers: await authHeaders(),
    })
    if (!res.ok) return ""
    const d = (await res.json()) as { content?: unknown }
    return typeof d.content === "string" ? d.content : ""
  } catch {
    return ""
  }
}

export async function saveNote(key: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/api/notes/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ content }),
    })
    if (!res.ok) return false
    const d = (await res.json()) as { ok?: unknown }
    return Boolean(d.ok)
  } catch {
    return false
  }
}
