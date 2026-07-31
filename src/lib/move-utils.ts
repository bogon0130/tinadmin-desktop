/**
 * 파일 이동 판단 로직 (순수 함수).
 *
 * UI 와 분리해 둔다 — GUI 를 띄우지 않고도 "어디로 옮길지/옮길 필요가 있는지"를
 * 검증할 수 있게. 드래그 경로와 버튼(폴더 선택) 경로가 이 함수를 공유한다.
 */

/** 파일 relpath 에서 상위 폴더를 뽑는다. 최상위면 '' */
export function dirOf(fileName: string): string {
  const i = fileName.lastIndexOf("/")
  return i === -1 ? "" : fileName.slice(0, i)
}

/** 폴더 뺀 파일명 */
export function baseOf(fileName: string): string {
  const i = fileName.lastIndexOf("/")
  return i === -1 ? fileName : fileName.slice(i + 1)
}

export interface MovePlan {
  /** 옮길 필요가 없으면 true (같은 폴더) */
  skip: boolean
  from: string
  /** 목적지 폴더 ('' = 최상위) */
  toDir: string
  /** 이동 후 예상 경로 */
  resultName: string
  reason?: string
}

/** 이동 계획을 세운다. 실제 호출 전에 불필요한 요청을 걸러낸다. */
export function planMove(fileName: string, toDir: string): MovePlan {
  const cur = dirOf(fileName)
  const base = baseOf(fileName)
  const dest = (toDir ?? "").replace(/^\/+|\/+$/g, "")
  const resultName = dest ? `${dest}/${base}` : base

  if (cur === dest) {
    return { skip: true, from: fileName, toDir: dest, resultName, reason: "이미 그 폴더에 있습니다" }
  }
  return { skip: false, from: fileName, toDir: dest, resultName }
}

/** 이 파일을 옮길 수 있는 폴더 후보 (현재 폴더는 제외) */
export function moveTargets(fileName: string, dirs: string[]): string[] {
  const cur = dirOf(fileName)
  return ["", ...dirs].filter((d) => d !== cur)
}
