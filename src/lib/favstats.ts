import { getApiUrl, getToken } from "./api"

/**
 * 캐릭터 최대 능력치 조회 (GET /api/favstats/<id>).
 *
 * 게임에서 "점수"를 치면 각 캐릭터 tin 자반이 그 줄을 서버에 파일로 떨구고,
 * 서버가 최대값 3개만 뽑아 준다.
 *
 * ★lib/api.ts 를 고치지 않으려고 따로 뒀다★
 *   그 파일의 request() 는 밖으로 내보내지 않아서 재사용할 수 없다. 대신
 *   서버 주소와 토큰을 얻는 함수(getApiUrl/getToken)만 가져다 쓴다 —
 *   주소·인증 방식이 바뀌어도 여기는 따라온다.
 *
 * 값이 없는 건 오류가 아니다. 아직 접속해서 점수를 치지 않은 캐릭터일 뿐이라
 * 전부 null 로 돌려주고 화면은 "-" 를 보여준다.
 */

export interface FavStat {
  name: string | null
  hpMax: number | null
  mpMax: number | null
  mvMax: number | null
}

export const EMPTY_STAT: FavStat = {
  name: null,
  hpMax: null,
  mpMax: null,
  mvMax: null,
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/** 실패해도 던지지 않는다 — 카드 하나 때문에 화면이 죽으면 안 된다. */
export async function getFavStat(id: string): Promise<FavStat> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(`${getApiUrl()}/api/favstats/${encodeURIComponent(id)}`, {
      headers,
    })
    if (!res.ok) return { ...EMPTY_STAT }
    const d = (await res.json()) as Record<string, unknown>
    return {
      name: typeof d.name === "string" ? d.name : null,
      hpMax: num(d.hpMax),
      mpMax: num(d.mpMax),
      mvMax: num(d.mvMax),
    }
  } catch {
    return { ...EMPTY_STAT }
  }
}
