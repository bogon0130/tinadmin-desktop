import { describe, expect, test } from "bun:test"

import { parseGroupSummary } from "./group-doc"

const 한비광 = `# 한비광그룹 운영 참고서

> 이 문서는 **뼈대**다.

## 세션 · 창 위치

tmux 세션: **goblin** (창 4개)

| 창 | 이름 |
| --- | --- |
| 0 | 한비광 |
`

const 천마 = `# 천마신군그룹 운영 참고서

## 세션 · 창 위치

tmux 세션: **chunma** (창 6개)
`

describe("그룹 참고서 요약 추출", () => {
  test("실제 문서에서 제목·세션·창 수를 뽑는다", () => {
    expect(parseGroupSummary(한비광)).toEqual({
      title: "한비광그룹 운영 참고서",
      session: "goblin",
      windows: 4,
    })
    expect(parseGroupSummary(천마)).toEqual({
      title: "천마신군그룹 운영 참고서",
      session: "chunma",
      windows: 6,
    })
  })

  test("H1 은 첫 번째 것만 쓴다 (## 은 제목이 아니다)", () => {
    const md = "## 먼저 나온 소제목\n# 진짜 제목\n# 나중 제목"
    expect(parseGroupSummary(md).title).toBe("진짜 제목")
  })

  test("제목의 굵게/코드 표시는 벗긴다", () => {
    expect(parseGroupSummary("# **한비광**그룹 `참고서`").title).toBe(
      "한비광그룹 참고서",
    )
  })

  test("굵게 표시 없이 써도 세션명을 찾는다", () => {
    expect(parseGroupSummary("tmux 세션: goblin (창 4개)").session).toBe("goblin")
  })

  test("세션만 있고 창 수가 없어도 세션은 살린다", () => {
    const s = parseGroupSummary("# 제목\ntmux 세션: **chunma**")
    expect(s.session).toBe("chunma")
    expect(s.windows).toBeNull()
  })

  // 요약은 부가 정보다 — 못 찾아도 화면이 죽으면 안 된다
  test("아무것도 못 찾으면 조용히 비운다", () => {
    expect(parseGroupSummary("그냥 평범한 문장")).toEqual({
      title: "",
      session: null,
      windows: null,
    })
  })

  test("빈 값·잘못된 타입에도 죽지 않는다", () => {
    expect(parseGroupSummary("")).toEqual({ title: "", session: null, windows: null })
    expect(
      parseGroupSummary(undefined as unknown as string).session,
    ).toBeNull()
  })

  test("창 0개 같은 이상한 값은 무시한다", () => {
    expect(parseGroupSummary("창 0개").windows).toBeNull()
  })

  test("CRLF 문서도 처리한다", () => {
    const s = parseGroupSummary("# 제목\r\ntmux 세션: **goblin** (창 4개)\r\n")
    expect(s.title).toBe("제목")
    expect(s.session).toBe("goblin")
    expect(s.windows).toBe(4)
  })
})
