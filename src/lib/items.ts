import { getApiUrl, getToken } from "./api"

/**
 * 아이템 도감 조회 (GET /api/items).
 *
 * ★lib/api.ts 를 고치지 않으려고 따로 뒀다★
 *   favstats.ts/groups.ts/notes-store.ts 와 같은 패턴 — request() 를 내보내지
 *   않아서 재사용할 수 없으니 주소·토큰만 빌려 쓴다.
 *
 * 서버는 raw_line(원문 한 줄)+부위만 준다. 컬럼을 여기서도 억지로 쪼개지
 * 않는다 — 화면에서 탭(\t) 기준으로 그때그때 나눠 표시한다.
 */

export interface ItemRow {
  부위: string
  raw_line: string
}

/** 실패해도 던지지 않는다 — 화면이 빈 목록으로만 뜨고 죽지 않는다. */
export async function getItems(): Promise<ItemRow[]> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(`${getApiUrl()}/api/items`, { headers })
    if (!res.ok) return []
    const d = (await res.json()) as unknown
    return Array.isArray(d) ? (d as ItemRow[]) : []
  } catch {
    return []
  }
}
