import { getApiUrl, getToken } from "./api"

/**
 * 리더 자반 배정 (GET/POST /api/leader/<group>) — 장군·대부 두 그룹만.
 *
 * 서버가 원본 tin(`2_{그룹}/{이름}.tin`)에 `#read tin/3_직업별_자반/리더.tin`
 * 한 줄을 넣고 뺀다. **상태를 따로 저장하지 않는다** — 그 줄을 가진 파일이
 * 곧 "현재 리더"다. 별도 저장소를 두면 파일과 어긋나 리더가 둘이 되거나
 * 없어질 수 있어서 일부러 그렇게 만들었다.
 *
 * ★파일만 바뀐다★ 원본에는 `#session` 이 있어 서버의 바로적용(apply)이 먼저
 *   막는다. 그래서 사냥 중인 창은 건드려지지 않고, 반영은 그 캐릭터를 다시
 *   띄울 때 이뤄진다. 확인창에 그 사실을 적어야 한다.
 *
 * ★lib/api.ts 를 고치지 않으려고 따로 뒀다★ favstats.ts·groups.ts 와 같은 방식.
 */

/** 리더를 둘 수 있는 그룹 — 교황·마왕은 리더 개념이 없다(버프 자반이 대신한다). */
export const LEADER_GROUPS = new Set(["장군", "대부"])

export interface LeaderInfo {
  /** 현재 리더. 아무도 없으면 null */
  leader: string | null
  /** 리더 줄을 가진 캐릭터 전부 — 정상이면 0명 또는 1명이다 */
  holders: string[]
}

export const EMPTY_LEADER: LeaderInfo = { leader: null, holders: [] }

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" }
  const t = getToken()
  if (t) h.Authorization = `Bearer ${t}`
  return h
}

/** 실패해도 던지지 않는다 — 표시가 "확인 불가"로 남을 뿐 화면은 살아야 한다. */
export async function getLeader(group: string): Promise<LeaderInfo> {
  try {
    const res = await fetch(`${getApiUrl()}/api/leader/${encodeURIComponent(group)}`, {
      headers: await headers(),
    })
    if (!res.ok) return { ...EMPTY_LEADER }
    const d = (await res.json()) as Record<string, unknown>
    return {
      leader: typeof d.leader === "string" ? d.leader : null,
      holders: Array.isArray(d.holders) ? (d.holders as string[]) : [],
    }
  } catch {
    return { ...EMPTY_LEADER }
  }
}

/** 리더를 name 으로 옮긴다. 실패하면 이유를 던진다(사용자에게 보여줘야 한다). */
export async function setLeader(
  group: string,
  name: string,
): Promise<{ previous: string | null; leader: string; changed: boolean }> {
  const res = await fetch(`${getApiUrl()}/api/leader/${encodeURIComponent(group)}`, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ name }),
  })
  const d = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || !d.ok) {
    throw new Error(typeof d.error === "string" ? d.error : "리더를 바꾸지 못했습니다.")
  }
  return {
    previous: typeof d.previous === "string" ? d.previous : null,
    leader: String(d.leader ?? name),
    changed: d.changed === true,
  }
}
