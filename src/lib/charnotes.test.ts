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

describe("그룹 메모 — 캐릭터 메모와 같은 구조, 다른 파일", () => {
  test("그룹명을 키로 저장/조회된다", () => {
    const s = setNote(EMPTY_NOTES, "천마신군그룹", "수리 alias 4명 누락")
    expect(getNote(s, "천마신군그룹")).toBe("수리 alias 4명 누락")
  })

  test("★두 저장소가 서로 안 섞인다★ (다른 객체이므로 독립)", () => {
    const charStore = setNote(EMPTY_NOTES, "천마신군", "캐릭 메모")
    const groupStore = setNote(EMPTY_NOTES, "천마신군그룹", "그룹 메모")
    // 캐릭 저장소에 그룹 키가 없고, 그 반대도 마찬가지
    expect(getNote(charStore, "천마신군그룹")).toBe("")
    expect(getNote(groupStore, "천마신군")).toBe("")
    expect(getNote(charStore, "천마신군")).toBe("캐릭 메모")
    expect(getNote(groupStore, "천마신군그룹")).toBe("그룹 메모")
  })

  test("그룹 두 개가 독립적이다", () => {
    let s = setNote(EMPTY_NOTES, "한비광그룹", "A")
    s = setNote(s, "천마신군그룹", "B")
    expect(getNote(s, "한비광그룹")).toBe("A")
    expect(getNote(s, "천마신군그룹")).toBe("B")
  })

  test("빈 메모면 ● 표시가 사라진다 (항목 삭제)", () => {
    let s = setNote(EMPTY_NOTES, "한비광그룹", "할일")
    expect(getNote(s, "한비광그룹")).toBeTruthy()
    s = setNote(s, "한비광그룹", "")
    expect(getNote(s, "한비광그룹")).toBe("")
    expect(Object.keys(s.notes)).toEqual([])
  })

  test("왕복 보존 (재시작 후 유지되는지의 자료층 근거)", () => {
    const s = setNote(setNote(EMPTY_NOTES, "한비광그룹", "가"), "천마신군그룹", "나")
    const round = parseNotes(JSON.stringify(s)).store
    expect(round).toEqual(s)
    expect(getNote(round, "천마신군그룹")).toBe("나")
  })
})
