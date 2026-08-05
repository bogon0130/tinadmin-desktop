/**
 * 그룹 참고서 문서에서 화면 상단 요약에 쓸 값만 뽑아낸다.
 *
 * ★문서를 고쳐 쓰지 않는다★
 *   md 원문은 서버가 진실이고 사용자가 자유롭게 편집한다. 여기서는 읽어서
 *   보여줄 것만 추출하고, 못 찾으면 조용히 비운다. 파싱이 실패해도 화면은
 *   제목만 띄우고 정상 동작해야 한다 — 요약은 어디까지나 부가 정보다.
 *
 * 지금 문서가 쓰는 형식(tinadmin/docs/*.md):
 *   # 한비광그룹 운영 참고서
 *   ## 세션 · 창 위치
 *   tmux 세션: **goblin** (창 4개)
 */

export interface GroupSummary {
  /** 문서 첫 H1. 없으면 빈 문자열 */
  title: string
  /** tmux 세션명. 못 찾으면 null */
  session: string | null
  /** 창 개수. 못 찾으면 null */
  windows: number | null
}

export const EMPTY_SUMMARY: GroupSummary = {
  title: "",
  session: null,
  windows: null,
}

/** `**굵게**` / `` `코드` `` 표시를 벗겨 평문만 남긴다 */
function stripMarks(s: string): string {
  return s.replace(/\*\*/g, "").replace(/`/g, "").trim()
}

export function parseGroupSummary(md: string): GroupSummary {
  if (!md || typeof md !== "string") return EMPTY_SUMMARY

  const text = md.replace(/\r\n/g, "\n")

  // 첫 번째 H1 (# 로 시작하는 줄). ## 이상은 제외한다.
  let title = ""
  for (const line of text.split("\n")) {
    const m = line.match(/^#\s+(.+)$/)
    if (m) {
      title = stripMarks(m[1])
      break
    }
  }

  // "tmux 세션: **goblin** (창 4개)" — 세션명과 창 수를 따로 찾는다.
  // 둘을 한 정규식으로 묶으면 한쪽 표기가 바뀔 때 둘 다 못 찾는다.
  let session: string | null = null
  const sm = text.match(/tmux\s*세션\s*[:：]\s*\*{0,2}([A-Za-z0-9_\-]+)\*{0,2}/)
  if (sm) session = sm[1]

  let windows: number | null = null
  const wm = text.match(/창\s*(\d+)\s*개/)
  if (wm) {
    const n = Number(wm[1])
    if (Number.isFinite(n) && n > 0) windows = n
  }

  return { title, session, windows }
}
