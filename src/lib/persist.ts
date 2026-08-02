import { useCallback, useState } from "react"

/**
 * 화면을 옮겨 다녀도 유지돼야 하는 작은 UI 상태를 localStorage 에 담아두는 훅.
 *
 * ★왜 필요한가★
 *   App 은 {view === "files" && <FilesView />} 처럼 조건부로 렌더한다.
 *   다른 메뉴를 눌렀다 돌아오면 컴포넌트가 통째로 언마운트/재마운트되어
 *   useState 값이 초기값으로 돌아간다. 폴더를 접어둬도 메뉴를 한 번 옮기면
 *   다시 펼쳐지던 게 이 때문이다.
 *
 * 저장 자체가 실패해도(용량 초과·프라이빗 모드 등) 화면은 계속 동작해야 하므로
 * 읽기/쓰기 모두 예외를 삼킨다. 최악의 경우 "기억을 못 할 뿐" 이다.
 */

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장 못 해도 화면 동작에는 지장 없음 */
  }
}

/**
 * 문자열 집합을 localStorage 에 유지한다 (접힌 폴더 목록 등).
 *
 * Set 을 그대로 두면 참조가 같아 리렌더가 안 걸리므로, 갱신할 때마다
 * 새 Set 을 만들어 넣는다.
 */
export function usePersistentSet(
  key: string,
): [Set<string>, (updater: (prev: Set<string>) => Set<string>) => void, (v: Set<string>) => void] {
  const [set, setSet] = useState<Set<string>>(() => {
    const arr = readJSON<string[]>(key, [])
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [])
  })

  const update = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setSet((prev) => {
        const next = updater(prev)
        writeJSON(key, [...next])
        return next
      })
    },
    [key],
  )

  const replace = useCallback(
    (v: Set<string>) => {
      writeJSON(key, [...v])
      setSet(new Set(v))
    },
    [key],
  )

  return [set, update, replace]
}

/** 임의 값을 localStorage 에 유지한다 (펼침/접힘 같은 단순 플래그). */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readJSON<T>(key, initial))

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v
        writeJSON(key, next)
        return next
      })
    },
    [key],
  )

  return [value, set]
}
