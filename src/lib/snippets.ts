/**
 * tin 스니펫(양식) 삽입 로직.
 *
 * UI 와 분리된 순수 함수로 둔다 — 화면 없이도 삽입 위치/커서 복원을 검증할 수 있게.
 *
 * 양식은 실제 tin 파일에 쓰인 형태를 근거로 만들었다:
 *   #action 160개 — %1 캡처 84 / 고정 문자열 54 / %* 와일드카드 22
 *     -> 한 가지 양식으로는 부족해서 3종으로 나눴다
 *   #alias 13개 — 세션전환 {#{한비광}} 4 / 한 글자 치환 5 / 여러 줄 블록 4
 *     -> 실사용에 없는 '명령1;명령2' 한 줄 형태 대신 실제 형태를 따랐다
 *   #ticker 11개 / #nop 90여개
 */

export interface Snippet {
  id: string
  label: string
  /** 버튼에 마우스 올렸을 때 설명 */
  hint: string
  text: string
}

export const SNIPPETS: Snippet[] = [
  {
    id: "action-basic",
    label: "자동반응·기본",
    hint: "게임에 특정 글자가 뜨면 명령을 보낸다 (실제 파일에 54개)",
    text: "#action {<게임에 뜨는 글자>} {<보낼 명령>}",
  },
  {
    id: "action-wild",
    label: "자동반응·일부만",
    hint: "글자 일부만 맞아도 반응한다. %* 는 아무 글자나 (22개)",
    text: "#action {%*<글자 일부>%*} {<보낼 명령>}",
  },
  {
    id: "action-capture",
    label: "자동반응·값받기",
    hint: "%1 로 잡은 값을 명령에서 다시 쓴다 (가장 많이 쓰임, 84개)",
    text: "#action {<앞>%1<뒤>} {<명령> %1}",
  },
  {
    id: "alias",
    label: "줄임말",
    hint: "짧게 치면 실제 명령으로 바뀐다",
    text: "#alias {<짧은말>} {<실제 명령>}",
  },
  {
    id: "alias-multi",
    label: "줄임말·여러줄",
    hint: "명령 여러 개를 묶어서 한 번에 실행한다",
    text: "#alias {<짧은말>} {\n    <명령1>;\n    <명령2>;\n}",
  },
  {
    id: "ticker",
    label: "반복",
    hint: "정해진 초마다 명령을 반복한다. 같은 이름이면 기존 것을 덮어쓴다",
    text: "#ticker {<이름>} {<반복할 명령>} {<초>}",
  },
  {
    id: "nop",
    label: "메모",
    hint: "실행되지 않는 설명 줄",
    text: "#nop <설명>",
  },
  {
    id: "nop-divider",
    label: "구분선",
    hint: "자반을 묶어서 구분하는 제목 줄",
    text: "#nop === <제목> ===",
  },
]

/**
 * 채워야 할 빈칸(placeholder) 패턴.
 *
 * tin 문법의 색상 코드 <120> 과 헷갈리지 않게 "한글이나 영문이 최소 한 글자
 * 들어간 꺾쇠"만 잡는다. 실제 tin 파일에 한글이 든 <...> 는 하나도 없다(전수 확인).
 *
 * 개행을 넘지 않는다([^<>\n]) — 넘게 두면 파일 여기저기의 < 와 > 가 여러 줄에 걸쳐
 * 짝지어져 오탐이 난다(stats.tin 에서 실제로 발생해서 고침).
 */
export const PLACEHOLDER_RE = /<[^<>\n]*[가-힣a-zA-Z][^<>\n]*>/g

export interface PlaceholderHit {
  /** 1-based 줄 번호 */
  line: number
  /** <...> 원문 */
  text: string
  /** 문자열 전체 기준 시작 위치 */
  index: number
}

/** 아직 안 채운 빈칸을 모두 찾는다. */
export function findPlaceholders(value: string): PlaceholderHit[] {
  const out: PlaceholderHit[] = []
  const re = new RegExp(PLACEHOLDER_RE.source, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) {
    const line = value.slice(0, m.index).split("\n").length
    out.push({ line, text: m[0], index: m.index })
  }
  return out
}

export interface InsertResult {
  /** 삽입된 전체 텍스트 */
  value: string
  /** 삽입 후 커서(또는 선택) 시작 */
  selStart: number
  /** 삽입 후 커서(또는 선택) 끝 */
  selEnd: number
}

/**
 * 커서 위치에 양식을 끼워 넣는다.
 *
 * - 양식은 항상 새 줄에서 시작해야 하므로, 커서가 줄 중간이면 앞에 개행을 붙인다.
 * - 뒤에 개행이 없으면 붙여서 다음 내용과 붙지 않게 한다.
 * - 삽입한 양식 안의 첫 <...> 를 선택 범위로 돌려준다(바로 타이핑해 덮어쓰게).
 *   빈칸이 없으면 삽입한 내용 끝에 커서를 둔다.
 */
export function insertSnippet(
  value: string,
  selStart: number,
  selEnd: number,
  snippetText: string,
): InsertResult {
  const rawStart = Math.max(0, Math.min(selStart, value.length))
  const rawEnd = Math.max(rawStart, Math.min(selEnd, value.length))

  // 커서가 걸친 줄의 범위를 구한다
  const lineStart = value.lastIndexOf("\n", rawStart - 1) + 1
  let lineEnd = value.indexOf("\n", rawEnd)
  if (lineEnd === -1) lineEnd = value.length
  const curLine = value.slice(lineStart, lineEnd)

  // ★줄을 쪼개지 않는다★
  //   커서가 내용 있는 줄 안에 있으면 그 줄 '끝'에 새 줄로 붙인다.
  //   커서 자리에서 그냥 쪼개면, 버튼을 연달아 누를 때(첫 삽입 후 커서가 빈칸=줄
  //   중간에 있다) 두 번째 양식이 첫 양식 한가운데로 들어가 둘 다 깨진다.
  const insertAt = curLine.trim() === "" ? rawStart : lineEnd
  const start = insertAt
  const end = curLine.trim() === "" ? rawEnd : lineEnd

  const before = value.slice(0, start)
  const after = value.slice(end)

  // 앞 보정 — 문서 맨 앞이거나 줄 시작이 아니면 개행을 넣는다
  const atLineStart = before.length === 0 || before.endsWith("\n")
  const prefix = atLineStart ? "" : "\n"

  // 뒤 보정 — 뒤에 내용이 있는데 개행으로 시작하지 않으면 개행을 넣는다
  const suffix = after.length === 0 || after.startsWith("\n") ? "" : "\n"

  const inserted = prefix + snippetText + suffix
  const newValue = before + inserted + after

  // 삽입된 양식 안에서 첫 빈칸을 찾아 선택 범위로
  const snippetStart = start + prefix.length
  const re = new RegExp(PLACEHOLDER_RE.source)
  const hit = re.exec(snippetText)
  if (hit) {
    return {
      value: newValue,
      selStart: snippetStart + hit.index,
      selEnd: snippetStart + hit.index + hit[0].length,
    }
  }
  const caret = snippetStart + snippetText.length
  return { value: newValue, selStart: caret, selEnd: caret }
}

/** 중괄호 짝이 맞는지 (서버 저장 검사와 같은 기준) */
export function bracesBalanced(text: string): boolean {
  let n = 0
  for (const ch of text) {
    if (ch === "{") n++
    else if (ch === "}") n--
  }
  return n === 0
}
