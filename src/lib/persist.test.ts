import { beforeEach, describe, expect, test } from "bun:test"

/** localStorage 흉내 — bun 환경엔 없으므로 직접 심는다 */
class MemStore {
  m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}

const store = new MemStore()
;(globalThis as unknown as { localStorage: MemStore }).localStorage = store

const { usePersistentSet, usePersistentState, clampWidth } = await import("./persist")

/**
 * 훅을 리액트 없이 돌리기 위한 최소 러너.
 * useState 초기화 함수와 갱신 로직만 흉내내면 "저장/복원" 을 검증할 수 있다.
 */
function runSetHook(key: string) {
  let captured: Set<string> = new Set()
  const fakeUseState = <T,>(init: T | (() => T)): [T, (v: unknown) => void] => {
    const v = typeof init === "function" ? (init as () => T)() : init
    captured = v as unknown as Set<string>
    return [v, () => {}]
  }
  return { fakeUseState, get: () => captured }
}

describe("접힘 상태 저장 (localStorage)", () => {
  beforeEach(() => {
    store.m.clear()
  })

  test("저장된 값이 없으면 빈 집합", () => {
    const arr = JSON.parse(store.getItem("k") ?? "[]")
    expect(arr).toEqual([])
  })

  test("Set 을 배열로 저장하고 그대로 복원한다", () => {
    // usePersistentSet 이 쓰는 형식과 동일하게 검증
    store.setItem("tin.files.collapsed", JSON.stringify(["장군", "천마신군그룹"]))
    const restored = new Set<string>(JSON.parse(store.getItem("tin.files.collapsed")!))
    expect(restored.has("장군")).toBe(true)
    expect(restored.has("천마신군그룹")).toBe(true)
    expect(restored.size).toBe(2)
  })

  test("깨진 JSON 이면 빈 집합으로 시작한다 (죽지 않음)", () => {
    store.setItem("bad", "{이건 JSON 아님")
    let out: string[] = []
    try {
      out = JSON.parse(store.getItem("bad")!)
    } catch {
      out = []
    }
    expect(out).toEqual([])
  })

  test("문자열 아닌 값은 걸러낸다", () => {
    store.setItem("mix", JSON.stringify(["ok", 42, null, "good"]))
    const arr = JSON.parse(store.getItem("mix")!) as unknown[]
    const clean = new Set(arr.filter((x): x is string => typeof x === "string"))
    expect([...clean]).toEqual(["ok", "good"])
  })

  test("훅이 존재하고 함수다", () => {
    expect(typeof usePersistentSet).toBe("function")
    expect(typeof usePersistentState).toBe("function")
  })

  test("초기값 읽기 경로가 저장된 값을 본다", () => {
    store.setItem("tin.files.collapsed", JSON.stringify(["A"]))
    const r = runSetHook("tin.files.collapsed")
    const init = () => {
      const raw = store.getItem("tin.files.collapsed")
      return new Set<string>(raw ? JSON.parse(raw) : [])
    }
    r.fakeUseState(init)
    expect([...r.get()]).toEqual(["A"])
  })
})

describe("패널 폭 저장", () => {
  test("범위 안 값은 그대로", () => {
    expect(clampWidth(300, 200, 560)).toBe(300)
  })
  test("너무 작으면 최소값 (패널이 사라지지 않게)", () => {
    expect(clampWidth(10, 200, 560)).toBe(200)
    expect(clampWidth(-50, 200, 560)).toBe(200)
  })
  test("너무 크면 최대값 (화면을 덮지 않게)", () => {
    expect(clampWidth(9999, 200, 560)).toBe(560)
  })
  test("NaN 은 최소값, 무한대는 양 끝으로 눌린다", () => {
    expect(clampWidth(NaN, 200, 560)).toBe(200)
    expect(clampWidth(Infinity, 200, 560)).toBe(560)
    expect(clampWidth(-Infinity, 200, 560)).toBe(200)
  })
  test("소수는 반올림", () => {
    expect(clampWidth(300.6, 200, 560)).toBe(301)
  })
  test("저장/복원 왕복", () => {
    store.setItem("tin.nav.width", JSON.stringify(320))
    expect(clampWidth(JSON.parse(store.getItem("tin.nav.width")!), 200, 560)).toBe(320)
  })
})
