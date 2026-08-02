import { describe, expect, test } from "bun:test"
import {
  EMPTY_NOTES,
  MAX_NOTE,
  getNote,
  parseNotes,
  setNote,
  validNote,
} from "./charnotes"

describe("메모 읽기/쓰기", () => {
  test("설정하고 다시 읽는다", () => {
    const s = setNote(EMPTY_NOTES, "천마신군", "수리 alias 고칠 것")
    expect(getNote(s, "천마신군")).toBe("수리 alias 고칠 것")
  })

  test("없는 캐릭터는 빈 문자열", () => {
    expect(getNote(EMPTY_NOTES, "없는캐릭")).toBe("")
  })

  test("빈 메모를 넣으면 항목을 지운다 (파일이 커지지 않게)", () => {
    let s = setNote(EMPTY_NOTES, "커", "임시")
    expect(Object.keys(s.notes)).toEqual(["커"])
    s = setNote(s, "커", "   ")
    expect(Object.keys(s.notes)).toEqual([])
  })

  test("여러 캐릭터가 독립적이다", () => {
    let s = setNote(EMPTY_NOTES, "한비광", "A")
    s = setNote(s, "담화린", "B")
    expect(getNote(s, "한비광")).toBe("A")
    expect(getNote(s, "담화린")).toBe("B")
  })

  test("앞뒤 공백은 다듬는다", () => {
    const s = setNote(EMPTY_NOTES, "커", "  할일  ")
    expect(getNote(s, "커")).toBe("할일")
  })

  test("길이 검증", () => {
    expect(validNote("짧은 메모")).toBeNull()
    expect(validNote("가".repeat(MAX_NOTE))).toBeNull()
    expect(validNote("가".repeat(MAX_NOTE + 1))).not.toBeNull()
  })
})

describe("깨진 파일 방어", () => {
  test("빈 문자열 -> 빈 목록", () => {
    expect(parseNotes("").store).toEqual(EMPTY_NOTES)
    expect(parseNotes("").warning).toBeNull()
  })

  test("깨진 JSON -> 빈 목록 + 경고", () => {
    expect(parseNotes("{망가짐").store.notes).toEqual({})
    expect(parseNotes("{망가짐").warning).toContain("빈 목록")
  })

  test("배열이면 거부", () => {
    expect(parseNotes("[1,2]").warning).not.toBeNull()
  })

  test("문자열 아닌 값은 버리고 나머지는 살린다", () => {
    const raw = JSON.stringify({
      version: 1,
      notes: { 한비광: "정상", 복병: 42, 담화린: null },
    })
    const r = parseNotes(raw)
    expect(r.store.notes).toEqual({ 한비광: "정상" })
    expect(r.warning).toContain("2개")
  })

  test("왕복 보존", () => {
    const s = setNote(setNote(EMPTY_NOTES, "가", "1"), "나", "2")
    expect(parseNotes(JSON.stringify(s)).store).toEqual(s)
  })

  test("너무 긴 메모는 잘라서 읽는다", () => {
    const raw = JSON.stringify({ version: 1, notes: { 커: "가".repeat(MAX_NOTE + 500) } })
    expect(parseNotes(raw).store.notes["커"].length).toBe(MAX_NOTE)
  })
})
