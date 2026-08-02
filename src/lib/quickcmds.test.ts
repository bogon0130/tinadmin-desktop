import { describe, expect, test } from "bun:test"
import {
  EMPTY_QUICK,
  parseQuick,
  removeQuick,
  upsertQuick,
  validCommand,
  validLabel,
  type QuickCmd,
} from "./quickcmds"

const item = (o: Partial<QuickCmd> = {}): QuickCmd => ({
  id: "q1",
  label: "자동저장",
  command: "저장",
  session: "chunma",
  window: "커",
  ...o,
})

const NL = String.fromCharCode(10)
const CR = String.fromCharCode(13)
const TAB = String.fromCharCode(9)

describe("명령 검증", () => {
  test("정상 명령 통과", () => {
    for (const c of ["저장", "북", "막야도 수리", "#class {통계} {kill}"])
      expect(validCommand(c)).toBeNull()
  })

  test("빈 명령 거부", () => {
    expect(validCommand("")).not.toBeNull()
    expect(validCommand("   ")).not.toBeNull()
  })

  test("개행·제어문자 거부 (여러 줄 주입 방지)", () => {
    expect(validCommand("저장" + NL + "북")).not.toBeNull()
    expect(validCommand("저장" + CR + NL + "북")).not.toBeNull()
    expect(validCommand("저장" + TAB + "북")).not.toBeNull()
  })

  test("500자 초과 거부", () => {
    expect(validCommand("가".repeat(501))).not.toBeNull()
  })

  test("이름 검증", () => {
    expect(validLabel("자동저장")).toBeNull()
    expect(validLabel("")).not.toBeNull()
    expect(validLabel("가".repeat(41))).not.toBeNull()
  })
})

describe("깨진 파일 방어", () => {
  test("빈 문자열 -> 빈 목록, 경고 없음", () => {
    expect(parseQuick("").store).toEqual(EMPTY_QUICK)
    expect(parseQuick("").warning).toBeNull()
  })

  test("깨진 JSON -> 빈 목록 + 경고", () => {
    expect(parseQuick("{망가짐").store.items).toEqual([])
    expect(parseQuick("{망가짐").warning).toContain("빈 목록")
  })

  test("배열이면 거부", () => {
    expect(parseQuick("[1,2]").warning).not.toBeNull()
  })

  test("필수 칸 빠진 항목만 버리고 나머지는 살린다", () => {
    const raw = JSON.stringify({
      version: 1,
      items: [item({ id: "ok" }), { label: "이름만" }, null, { command: "명령만" }],
    })
    const r = parseQuick(raw)
    expect(r.store.items.map((i) => i.id)).toEqual(["ok"])
    expect(r.warning).toContain("3개")
  })

  test("왕복 보존", () => {
    const s = upsertQuick(EMPTY_QUICK, item())
    expect(parseQuick(JSON.stringify(s)).store).toEqual(s)
  })
})

describe("추가/수정/삭제", () => {
  test("추가", () => {
    expect(upsertQuick(EMPTY_QUICK, item()).items.length).toBe(1)
  })

  test("같은 id 는 덮어쓴다 (대상 창 변경 포함)", () => {
    let s = upsertQuick(EMPTY_QUICK, item())
    s = upsertQuick(s, item({ window: "천마신군", label: "새이름" }))
    expect(s.items.length).toBe(1)
    expect(s.items[0].window).toBe("천마신군")
    expect(s.items[0].label).toBe("새이름")
  })

  test("삭제", () => {
    expect(removeQuick(upsertQuick(EMPTY_QUICK, item()), "q1").items).toEqual([])
  })
})
