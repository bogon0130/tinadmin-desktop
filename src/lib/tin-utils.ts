import type {
  GroupType,
  Row,
  TableType,
  TinEntry,
} from "./types"

/** 켜기/끄기용 마커. 끄면 `#nop [OFF] #action {..} {..}` 형태로 주석 처리된다. */
export const OFF_MARK = "[OFF]"

export interface TypeMeta {
  /** 사이드바/제목에 쓸 한글 이름 */
  label: string
  /** 표의 열 이름들 */
  columns: string[]
  /** 최소로 채워야 하는 열 개수 (그룹형에서 선택 인자 구분용) */
  required: number
  /** 명령어 예시 + 설명 (우측 치트시트) */
  syntax: string
  help: string[]
}

export const TYPE_META: Record<TableType, TypeMeta> = {
  action: {
    label: "자반 (Action)",
    columns: ["찾을 문자열 (패턴)", "실행할 명령"],
    required: 2,
    syntax: "#action {찾을문자열} {명령}",
    help: [
      "게임 화면에 '찾을 문자열'이 뜨면 '명령'을 자동으로 보낸다. 가장 많이 쓰는 기능.",
      "예) #action {당신은 죽었습니다!} {시체}",
      "예) #action {%1{이|가} 당신을 따라다니기} {%1 그룹}",
    ],
  },
  alias: {
    label: "줄임말 (Alias)",
    columns: ["줄임말", "실제 명령"],
    required: 2,
    syntax: "#alias {줄임말} {명령}",
    help: [
      "내가 짧게 입력하면 긴 명령으로 바뀐다.",
      "예) #alias {ㄷ} {동}",
      "주의: 방향 알리아스가 있으면 '동 문 따' 같은 입력이 치환되어 깨질 수 있다. 그럴 땐 명령 앞에 백슬래시(\\)를 붙인다.",
    ],
  },
  variable: {
    label: "변수 (Variable)",
    columns: ["이름", "값"],
    required: 2,
    syntax: "#variable {이름} {값}",
    help: [
      "값을 저장해두고 $이름 으로 꺼내 쓴다.",
      "예) #variable {목표몹} {발석차}  →  이후 $목표몹 으로 사용",
    ],
  },
  ticker: {
    label: "타이머 (Ticker)",
    columns: ["이름", "실행할 명령", "주기(초)"],
    required: 3,
    syntax: "#ticker {이름} {명령} {초}",
    help: [
      "정해진 초마다 명령을 자동 반복 실행한다.",
      "예) #ticker {autosave} {저장} {180}  →  3분마다 저장",
      "삭제는 #unticker {이름}.",
      "※ #delay(한 번만 지연 실행)는 표로 분해되지 않고 'Raw 편집'에 원문으로 남는다.",
    ],
  },
  substitute: {
    label: "치환 (Substitute)",
    columns: ["원래 텍스트", "바꿀 텍스트", "우선순위(선택)"],
    required: 2,
    syntax: "#substitute {원래텍스트} {바꿀텍스트}",
    help: [
      "서버가 보낸 글자를 화면에 다르게 보이게 바꾼다. (게임에 명령을 보내는 게 아님)",
      "예) #substitute {발석차} {★발석차★}",
    ],
  },
  highlight: {
    label: "하이라이트 (Highlight)",
    columns: ["텍스트", "색상", "우선순위(선택)"],
    required: 2,
    syntax: "#highlight {텍스트} {색상}",
    help: [
      "특정 글자에 색을 입혀 눈에 띄게 한다.",
      "예) #highlight {발석차} {bold red}",
      "색: red, green, yellow, blue, cyan, white 등 + bold/light 조합",
    ],
  },
  gag: {
    label: "가그 (Gag)",
    columns: ["숨길 문자열"],
    required: 1,
    syntax: "#gag {문자열}",
    help: [
      "이 문자열이 들어간 줄을 화면에서 아예 안 보이게 지운다. 로그 정리용.",
      "예) #gag {당신은 배가 고픕니다}",
    ],
  },
  macro: {
    label: "매크로 (Macro)",
    columns: ["키 시퀀스", "실행할 명령"],
    required: 2,
    syntax: "#macro {키} {명령}",
    help: [
      "키보드 키를 누르면 명령이 실행된다.",
      "예) #macro {\\e1} {#{한비광}}  →  Alt+1 로 한비광 세션 전환",
      "키 코드: \\e1=Alt+1, \\eOP=F1 (터미널마다 다름)",
    ],
  },
  class: {
    label: "클래스 (Class)",
    columns: ["클래스 이름", "동작", "인자(선택)"],
    required: 2,
    syntax: "#class {이름} {open|close|kill|list}",
    help: [
      "자반들을 이름으로 묶어서 한꺼번에 켜고 끌 수 있게 한다.",
      "#class {사냥} {open} ... 자반들 ... #class {사냥} {close}",
      "#class {사냥} {kill} → 그 묶음의 자반을 통째로 제거 (상단 [전체중지] 버튼이 이걸 쓴다)",
    ],
  },
}

export const GROUP_TYPES: GroupType[] = [
  "substitute",
  "highlight",
  "gag",
  "macro",
  "class",
]

function isGroupType(t: string): t is GroupType {
  return (GROUP_TYPES as string[]).includes(t)
}

/** 문자열에서 최상위 {..} 그룹만 뽑는다 (중첩 중괄호는 하나로 유지). */
export function splitTopLevelBraces(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === "{") {
      if (depth === 0) start = i + 1
      depth++
    } else if (ch === "}") {
      if (depth > 0) {
        depth--
        if (depth === 0 && start >= 0) {
          out.push(s.slice(start, i))
          start = -1
        }
      }
    }
  }
  return out
}

/** entry(구조화된 항목) → 실제 .tin 한 줄 문자열 */
export function entryToLine(cmd: TableType, values: string[]): string {
  const meta = TYPE_META[cmd]
  // 뒤쪽의 빈 선택 인자는 잘라낸다
  const vals = [...values]
  while (vals.length > meta.required && (vals[vals.length - 1] ?? "") === "") {
    vals.pop()
  }
  return `#${cmd} ` + vals.map((v) => `{${v}}`).join(" ")
}

/** entry → 표 행에 보여줄 값 배열 */
function entryValues(e: TinEntry): string[] {
  switch (e.type) {
    case "action":
    case "alias":
      return [e.pattern, e.command]
    case "variable":
      return [e.name, e.value]
    case "ticker":
      return [e.name, e.command, e.seconds]
    case "substitute":
    case "highlight":
    case "gag":
    case "macro":
    case "class":
      return [...e.groups]
    default:
      return []
  }
}

/** 표 값 배열 → entry로 되돌리기 (id 유지) */
export function valuesToEntry(
  id: number,
  cmd: TableType,
  values: string[],
): TinEntry {
  const meta = TYPE_META[cmd]
  const vals = [...values]
  while (vals.length > meta.required && (vals[vals.length - 1] ?? "") === "") {
    vals.pop()
  }
  while (vals.length < meta.required) vals.push("")

  switch (cmd) {
    case "action":
    case "alias":
      return { id, type: cmd, pattern: vals[0] ?? "", command: vals[1] ?? "" }
    case "variable":
      return { id, type: "variable", name: vals[0] ?? "", value: vals[1] ?? "" }
    case "ticker":
      return {
        id,
        type: "ticker",
        name: vals[0] ?? "",
        command: vals[1] ?? "",
        seconds: vals[2] ?? "",
      }
    default:
      return { id, type: cmd, groups: vals }
  }
}

/** 꺼진(주석 처리된) 항목이면 원래 명령 정보를 돌려준다. */
export function parseOffComment(
  text: string,
): { cmd: TableType; values: string[] } | null {
  const t = text.trim()
  if (!t.startsWith(OFF_MARK)) return null
  const rest = t.slice(OFF_MARK.length).trim()
  const m = rest.match(/^#([a-z]+)\b/i)
  if (!m) return null
  const cmd = m[1].toLowerCase()
  if (!(cmd in TYPE_META)) return null
  return { cmd: cmd as TableType, values: splitTopLevelBraces(rest) }
}

/** 특정 종류의 행들을 (켜진 것 + 꺼진 것) 모아서 표에 쓸 형태로 만든다. */
export function rowsForType(entries: TinEntry[], cmd: TableType): Row[] {
  const rows: Row[] = []
  for (const e of entries) {
    if (e.type === cmd) {
      rows.push({ id: e.id, cmd, values: entryValues(e), enabled: true })
    } else if (e.type === "comment") {
      const off = parseOffComment(e.text)
      if (off && off.cmd === cmd) {
        rows.push({ id: e.id, cmd, values: off.values, enabled: false })
      }
    }
  }
  return rows
}

/** 행 하나를 켜거나 끈 결과 entry를 만든다. */
export function toggleRow(row: Row, enable: boolean): TinEntry {
  if (enable) {
    return valuesToEntry(row.id, row.cmd, row.values)
  }
  return {
    id: row.id,
    type: "comment",
    text: `${OFF_MARK} ${entryToLine(row.cmd, row.values)}`,
  }
}

/** entries 배열에서 id로 항목을 교체한다 (불변). */
export function replaceEntry(
  entries: TinEntry[],
  id: number,
  next: TinEntry,
): TinEntry[] {
  return entries.map((e) => (e.id === id ? next : e))
}

/** entries 배열에서 id로 항목을 지운다. */
export function removeEntry(entries: TinEntry[], id: number): TinEntry[] {
  return entries.filter((e) => e.id !== id)
}

/** 새 항목에 쓸 임시 id (기존과 겹치지 않게 음수) */
export function nextTempId(entries: TinEntry[]): number {
  let min = 0
  for (const e of entries) if (e.id < min) min = e.id
  return min - 1
}

/** Raw 편집 탭에 보여줄 항목들 (원본 블록 + 주석). 꺼진 항목 주석은 제외. */
export function rawEntries(entries: TinEntry[]): TinEntry[] {
  return entries.filter((e) => {
    if (e.type === "raw") return true
    if (e.type === "comment") return parseOffComment(e.text) === null
    return false
  })
}

export { isGroupType }
