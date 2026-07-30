import { TYPE_META } from "./tin-utils"

/**
 * tin 양식 폼 정의 + 조립/삽입 로직.
 *
 * UI 와 분리된 순수 함수로 둔다 — 화면 없이도 조립 결과와 삽입 위치를 검증할 수 있게.
 *
 * ★템플릿 문자열 방식에서 폼 방식으로 바꿨다★
 *   예전에는 `#action {<찾을 글자>} {<보낼 명령>}` 을 그대로 꽂고 사용자가 꺾쇠를
 *   지우며 채웠다. 이제는 폼에서 값을 받아 완성된 한 줄을 넣는다.
 *   그래서 편집기에는 꺾쇠가 아예 안 생기고, "안 채운 칸" 확인 절차도 필요 없다.
 *
 * 칸 이름은 자반 메뉴(EntryTable)가 쓰는 TYPE_META.columns 를 그대로 가져와
 * 두 화면의 용어를 맞춘다.
 */

export type FieldKind = "text" | "textarea" | "number" | "radio"

export interface Field {
  key: string
  label: string
  kind: FieldKind
  placeholder?: string
  /** 비어 있으면 [추가] 를 막는다 */
  required?: boolean
  /** radio 전용 */
  options?: { value: string; label: string }[]
  defaultValue?: string
  hint?: string
}

export interface SnippetForm {
  id: string
  label: string
  hint: string
  fields: Field[]
  /** 필드값 -> 완성된 tin 한 줄 (또는 여러 줄) */
  build: (v: Record<string, string>) => string
}

const A = TYPE_META.action.columns // ["찾을 문자열 (패턴)", "실행할 명령"]
const L = TYPE_META.alias.columns // ["줄임말", "실제 명령"]
const T = TYPE_META.ticker.columns // ["이름", "실행할 명령", "주기(초)"]

export const SNIPPET_FORMS: SnippetForm[] = [
  {
    id: "action-basic",
    label: "자동반응·기본",
    hint: "게임에 특정 글자가 뜨면 명령을 보낸다 (실제 파일에 54개)",
    fields: [
      { key: "pat", label: A[0], kind: "text", required: true, placeholder: "당신은 죽었습니다!" },
      { key: "cmd", label: A[1], kind: "text", required: true, placeholder: "시체" },
    ],
    build: (v) => `#action {${v.pat}} {${v.cmd}}`,
  },
  {
    id: "action-wild",
    label: "자동반응·일부만",
    hint: "글자 일부만 맞아도 반응한다. 앞뒤에 %* 가 붙는다 (22개)",
    fields: [
      {
        key: "part",
        label: "글자 일부",
        kind: "text",
        required: true,
        placeholder: "암호 :",
        hint: "앞뒤로 %* 가 자동으로 붙어 어디에 있든 반응한다",
      },
      { key: "cmd", label: A[1], kind: "text", required: true, placeholder: "183901" },
    ],
    build: (v) => `#action {%*${v.part}%*} {${v.cmd}}`,
  },
  {
    id: "action-capture",
    label: "자동반응·값받기",
    hint: "%1 로 잡은 값을 명령에서 다시 쓴다 (가장 많이 쓰임, 84개)",
    fields: [
      {
        key: "pre",
        label: "잡을 값 앞부분",
        kind: "text",
        placeholder: "(비워도 됨)",
        hint: "%1 자리에 들어갈 값의 앞/뒤 글자. 비우면 그 쪽은 제한 없음",
      },
      { key: "post", label: "잡을 값 뒷부분", kind: "text", placeholder: "이(가) 당신을 따라다니기" },
      { key: "cmd", label: "실행할 명령 (%1 사용 가능)", kind: "text", required: true, placeholder: "%1 그룹" },
    ],
    build: (v) => `#action {${v.pre}%1${v.post}} {${v.cmd}}`,
  },
  {
    id: "alias",
    label: "줄임말",
    hint: "짧게 치면 실제 명령으로 바뀐다",
    fields: [
      { key: "short", label: L[0], kind: "text", required: true, placeholder: "ㄷ" },
      { key: "cmd", label: L[1], kind: "text", required: true, placeholder: "동" },
    ],
    build: (v) => `#alias {${v.short}} {${v.cmd}}`,
  },
  {
    id: "alias-multi",
    label: "줄임말·여러줄",
    hint: "명령 여러 개를 묶어서 한 번에 실행한다",
    fields: [
      { key: "short", label: L[0], kind: "text", required: true, placeholder: "수동맵핑" },
      {
        key: "cmds",
        label: "명령 목록 (한 줄에 하나씩)",
        kind: "textarea",
        required: true,
        placeholder: "#map flag vtmap on\n#map flag static off",
        hint: "줄 끝의 ; 는 자동으로 붙는다",
      },
    ],
    build: (v) => {
      const lines = (v.cmds ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `    ${l.replace(/;+$/, "")};`)
      return `#alias {${v.short}} {\n${lines.join("\n")}\n}`
    },
  },
  {
    id: "ticker",
    label: "반복",
    hint: "정해진 초마다 명령을 반복한다. 같은 이름이면 기존 것을 덮어쓴다",
    fields: [
      { key: "name", label: T[0], kind: "text", required: true, placeholder: "자동저장" },
      { key: "cmd", label: T[1], kind: "text", required: true, placeholder: "저장" },
      { key: "sec", label: T[2], kind: "number", required: true, defaultValue: "180", placeholder: "180" },
    ],
    build: (v) => `#ticker {${v.name}} {${v.cmd}} {${v.sec}}`,
  },
  {
    id: "nop",
    label: "메모",
    hint: "실행되지 않는 설명 줄. 구분선 형식도 고를 수 있다",
    fields: [
      { key: "text", label: "내용", kind: "text", required: true, placeholder: "여기에 설명" },
      {
        key: "style",
        label: "형식",
        kind: "radio",
        defaultValue: "plain",
        options: [
          { value: "plain", label: "메모" },
          { value: "divider", label: "구분선" },
        ],
      },
    ],
    build: (v) =>
      v.style === "divider" ? `#nop === ${v.text} ===` : `#nop ${v.text}`,
  },
]

/** 필수 칸이 다 찼는지 (폼의 [추가] 버튼 활성 판단) */
export function isFormComplete(
  form: SnippetForm,
  values: Record<string, string>,
): boolean {
  return form.fields.every((f) => {
    if (!f.required) return true
    const v = (values[f.key] ?? "").trim()
    if (!v) return false
    if (f.kind === "number" && !/^\d+$/.test(v)) return false
    return true
  })
}

/** 폼 초기값 */
export function initialValues(form: SnippetForm): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of form.fields) out[f.key] = f.defaultValue ?? ""
  return out
}

export interface InsertResult {
  value: string
  selStart: number
  selEnd: number
}

/**
 * 커서 위치에 완성된 tin 줄을 끼워 넣는다.
 *
 * ★줄을 쪼개지 않는다★
 *   커서가 내용 있는 줄 안에 있으면 그 줄 '끝'에 새 줄로 붙인다.
 *   커서 자리에서 그냥 쪼개면 기존 자반 한가운데로 들어가 둘 다 깨진다.
 *
 * 삽입한 내용 끝에 커서를 둔다(폼에서 이미 값을 다 채웠으므로 선택할 빈칸이 없다).
 */
export function insertSnippet(
  value: string,
  selStart: number,
  selEnd: number,
  snippetText: string,
): InsertResult {
  const rawStart = Math.max(0, Math.min(selStart, value.length))
  const rawEnd = Math.max(rawStart, Math.min(selEnd, value.length))

  const lineStart = value.lastIndexOf("\n", rawStart - 1) + 1
  let lineEnd = value.indexOf("\n", rawEnd)
  if (lineEnd === -1) lineEnd = value.length
  const curLine = value.slice(lineStart, lineEnd)

  const blankLine = curLine.trim() === ""
  const start = blankLine ? rawStart : lineEnd
  const end = blankLine ? rawEnd : lineEnd

  const before = value.slice(0, start)
  const after = value.slice(end)

  const atLineStart = before.length === 0 || before.endsWith("\n")
  const prefix = atLineStart ? "" : "\n"
  const suffix = after.length === 0 || after.startsWith("\n") ? "" : "\n"

  const newValue = before + prefix + snippetText + suffix + after
  const caret = start + prefix.length + snippetText.length
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
