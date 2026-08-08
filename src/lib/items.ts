import { getApiUrl, getToken } from "./api"

/**
 * 아이템 도감 조회 (GET /api/items).
 *
 * ★lib/api.ts 를 고치지 않으려고 따로 뒀다★
 *   favstats.ts/groups.ts/notes-store.ts 와 같은 패턴 — request() 를 내보내지
 *   않아서 재사용할 수 없으니 주소·토큰만 빌려 쓴다.
 *
 * 서버는 엑셀(items_data/item.xlsx) 시트를 그대로 옮긴 구조를 준다 — 부위마다
 * 컬럼 구성이 다르므로(무기=타격치/평타/마법, 신발=종류 등) columns 로 그
 * 부위의 실제 헤더 순서를, rows 로 그 헤더 키를 그대로 쓰는 값 객체를 받는다.
 * 컬럼을 여기서 다시 쪼개거나 이름을 바꾸지 않는다.
 */

export interface ItemsData {
  parts: string[]
  columns: Record<string, string[]>
  rows: Array<Record<string, unknown>>
}

const EMPTY_ITEMS: ItemsData = { parts: [], columns: {}, rows: [] }

/** 실패해도 던지지 않는다 — 화면이 빈 구조로만 뜨고 죽지 않는다. */
export async function getItems(): Promise<ItemsData> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(`${getApiUrl()}/api/items`, { headers })
    if (!res.ok) return { ...EMPTY_ITEMS }
    const d = (await res.json()) as unknown
    if (
      d &&
      typeof d === "object" &&
      Array.isArray((d as ItemsData).parts) &&
      typeof (d as ItemsData).columns === "object" &&
      Array.isArray((d as ItemsData).rows)
    ) {
      return d as ItemsData
    }
    return { ...EMPTY_ITEMS }
  } catch {
    return { ...EMPTY_ITEMS }
  }
}
