/** 서버(parser.py)가 주고받는 .tin 항목 타입들 */

export type FixedType = "action" | "alias" | "variable" | "ticker"
export type GroupType = "substitute" | "highlight" | "gag" | "macro" | "class"
export type TableType = FixedType | GroupType

export interface BlankEntry {
  id: number
  type: "blank"
}

export interface CommentEntry {
  id: number
  type: "comment"
  text: string
}

export interface RawEntry {
  id: number
  type: "raw"
  text: string
}

export interface PairEntry {
  id: number
  type: "action" | "alias"
  pattern: string
  command: string
}

export interface VariableEntry {
  id: number
  type: "variable"
  name: string
  value: string
}

export interface TickerEntry {
  id: number
  type: "ticker"
  name: string
  command: string
  seconds: string
}

export interface GroupsEntry {
  id: number
  type: GroupType
  groups: string[]
}

export type TinEntry =
  | BlankEntry
  | CommentEntry
  | RawEntry
  | PairEntry
  | VariableEntry
  | TickerEntry
  | GroupsEntry

/** 표에 그릴 한 행 (원본 entry + 켜짐/꺼짐 상태) */
export interface Row {
  /** 원본 entries 배열에서의 id */
  id: number
  /** 이 행이 나타내는 명령 종류 */
  cmd: TableType
  /** 각 칸의 값 */
  values: string[]
  /** false면 #nop [OFF] 로 주석 처리된 상태 */
  enabled: boolean
}
