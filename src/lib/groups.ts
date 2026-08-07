import { getApiUrl, getToken } from "./api"

/**
 * 캐릭터 그룹 실시간 상태 (GET /api/groups).
 *
 * ★lib/api.ts 를 고치지 않으려고 따로 뒀다★
 *   favstats.ts 와 같은 이유·같은 방식이다. request() 가 밖으로 안 나와
 *   있어 재사용할 수 없으므로, 주소·토큰 함수만 가져다 쓰는 별도 모듈로 둔다.
 *
 * 서버는 tmux list-windows 를 실시간으로 조회해서 돌려준다(읽기 전용,
 * tmux 에 아무 명령도 보내지 않는다). 그래서 매 조회가 지금 이 순간의
 * 실제 상태다 — 캐시하지 않는다.
 */

export interface GroupChar {
  name: string
  /** 지금 이 순간 tmux 창이 실제로 살아있는지 */
  live: boolean
  files: string[]
  direct_files: string[]
  /** 레벨업 통계 자반이 붙어있는 캐릭터인지 (stats.tin #read 대상) */
  has_stats: boolean
  /** stats.log 에 실제 기록이 한 번이라도 있는지 */
  stats_logged: boolean
}

export interface GroupInfo {
  name: string
  characters: GroupChar[]
  session: string
  dir: string
  /** 설정(config.py GROUPS)에 등록된 창 이름 순서 — 실제 tmux 순서와 다를 수 있다 */
  windows: string[]
  /** tmux 세션 자체가 떠있는지 */
  live: boolean
  /** 실제 tmux 창 이름 — list-windows 순서 그대로라 창번호(0,1,2..)와 일치한다 */
  live_windows: string[]
  /** 설정엔 있는데 실제 창은 없는 이름 (예: 한비광그룹의 "복병" — 알려진 설정 오류) */
  missing_windows: string[]
  /** 실제로는 있는데 설정에 없는 창 */
  extra_windows: string[]
  files: string[]
  stats_chars: { name: string; attached: boolean; has_log: boolean }[]
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/** 실패해도 던지지 않는다 — 빈 배열을 주고 화면은 "불러오지 못함"만 보여준다. */
export async function getGroups(): Promise<GroupInfo[]> {
  try {
    const res = await fetch(`${getApiUrl()}/api/groups`, { headers: await authHeaders() })
    if (!res.ok) return []
    const d = (await res.json()) as { ok?: boolean; groups?: GroupInfo[] }
    return Array.isArray(d.groups) ? d.groups : []
  } catch {
    return []
  }
}
