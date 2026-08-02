import { describe, expect, test } from "bun:test"
import {
  EMPTY_SNIPS,
  parseSnips,
  removeSnip,
  upsertSnip,
  validSnipLabel,
  validSnipText,
  type TextSnip,
} from "./textsnips"
import { insertSnippet } from "./snippets"

/** 지시서에 나온 샘플 그대로 */
const SAMPLE: TextSnip = {
  id: "s1",
  label: "수리",
  text: "#alias {수리} {신월도 수리;갑옷 수리;저장;}",
}

describe("텍스트 검증", () => {
  test("정상 양식 통과", () => {
    expect(validSnipText(SAMPLE.text)).toBeNull()
  })

  test("여러 줄 허용 (명령 즐겨찾기와 다른 점)", () => {
    const multi = ["#action {x} {", "    명령1;", "    명령2", "}"].join("\n")
    expect(validSnipText(multi)).toBeNull()
  })

  test("중괄호 짝 안 맞으면 거부", () => {
    expect(validSnipText("#alias {수리} {저장;")).not.toBeNull()
    expect(validSnipText("#alias 수리} {저장}")).not.toBeNull()
  })

  test("빈 텍스트 거부", () => {
    expect(validSnipText("")).not.toBeNull()
    expect(validSnipText("   ")).not.toBeNull()
  })

  test("이름 검증", () => {
    expect(validSnipLabel("수리")).toBeNull()
    expect(validSnipLabel("")).not.toBeNull()
  })
})

describe("깨진 파일 방어", () => {
  test("빈 문자열 -> 빈 목록", () => {
    expect(parseSnips("").store).toEqual(EMPTY_SNIPS)
  })

  test("깨진 JSON -> 빈 목록 + 경고", () => {
    expect(parseSnips("{망가짐").store.items).toEqual([])
    expect(parseSnips("{망가짐").warning).toContain("빈 목록")
  })

  test("필수 칸 빠진 항목만 버린다", () => {
    const raw = JSON.stringify({
      version: 1,
      items: [SAMPLE, { label: "이름만" }, null],
    })
    const r = parseSnips(raw)
    expect(r.store.items.map((i) => i.id)).toEqual(["s1"])
    expect(r.warning).toContain("2개")
  })

  test("왕복 보존", () => {
    const s = upsertSnip(EMPTY_SNIPS, SAMPLE)
    expect(parseSnips(JSON.stringify(s)).store).toEqual(s)
  })
})

describe("추가/수정/삭제", () => {
  test("추가·덮어쓰기·삭제", () => {
    let s = upsertSnip(EMPTY_SNIPS, SAMPLE)
    expect(s.items.length).toBe(1)
    s = upsertSnip(s, { ...SAMPLE, label: "수리2" })
    expect(s.items.length).toBe(1)
    expect(s.items[0].label).toBe("수리2")
    expect(removeSnip(s, "s1").items).toEqual([])
  })
})

describe("삽입 — 기존 insertSnippet 재활용", () => {
  test("빈 파일에 삽입", () => {
    const r = insertSnippet("", 0, 0, SAMPLE.text)
    expect(r.value).toBe(SAMPLE.text)
  })

  test("★기존 자반을 쪼개지 않는다★ 줄 한가운데 커서여도 그 줄 끝에 붙는다", () => {
    const doc = "#action {가} {나}\n#alias {ㄷ} {동}\n"
    const mid = 8 // "#action {" 안쪽
    const r = insertSnippet(doc, mid, mid, SAMPLE.text)
    // 원래 첫 줄이 통째로 남아 있어야 한다
    expect(r.value).toContain("#action {가} {나}")
    expect(r.value.split("\n")[0]).toBe("#action {가} {나}")
    // 삽입된 양식도 온전한 한 줄
    expect(r.value).toContain(SAMPLE.text)
    // 원래 자반이 쪼개져 중복/조각으로 남지 않았는지
    expect(r.value.match(/#action/g)?.length).toBe(1)
    // 삽입 결과 = 원래 줄 / 양식 / 나머지 줄 순서
    expect(r.value).toBe(
      "#action {가} {나}\n" + SAMPLE.text + "\n#alias {ㄷ} {동}\n",
    )
  })

  test("여러 줄 양식도 온전히 들어간다", () => {
    const multi = ["#action {x} {", "    명령1;", "}"].join("\n")
    const r = insertSnippet("#alias {a} {b}\n", 0, 0, multi)
    expect(r.value).toContain(multi)
    expect(r.value).toContain("#alias {a} {b}")
  })

  test("삽입 후 커서가 끝에 온다", () => {
    const r = insertSnippet("", 0, 0, SAMPLE.text)
    expect(r.selStart).toBe(SAMPLE.text.length)
    expect(r.selStart).toBe(r.selEnd)
  })
})
