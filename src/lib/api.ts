import type { Preset, TinEntry } from "./types"

const URL_KEY = "tinadmin.apiUrl"
const TOKEN_KEY = "tinadmin.token"

export const DEFAULT_API_URL = "https://tin.bogon.kr"

export function getApiUrl(): string {
  return localStorage.getItem(URL_KEY) || DEFAULT_API_URL
}

export function setApiUrl(url: string) {
  localStorage.setItem(URL_KEY, url.replace(/\/+$/, ""))
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${getApiUrl()}${path}`, { ...init, headers })
  } catch (e) {
    throw new Error(
      `서버에 연결할 수 없습니다 (${getApiUrl()}). 주소를 확인하세요.\n${String(e)}`,
    )
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* 본문이 JSON이 아닐 수도 있음 */
  }

  if (!res.ok) {
    const msg =
      (data as { error?: string } | null)?.error ?? `요청 실패 (HTTP ${res.status})`
    const err = new Error(msg) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data as T
}

/** 비밀번호로 로그인하고 토큰을 저장한다. */
export async function login(password: string): Promise<void> {
  const data = await request<{ ok: boolean; token?: string }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  })
  if (!data.token) {
    throw new Error(
      "서버가 토큰을 주지 않았습니다. 서버(tinadmin)를 최신 버전으로 올려주세요.",
    )
  }
  setToken(data.token)
}

export async function loadFile(filename: string): Promise<TinEntry[]> {
  const data = await request<{ ok: boolean; entries: TinEntry[] }>(
    `/api/load/${encodeURIComponent(filename)}`,
  )
  return data.entries
}

export interface SaveResult {
  ok: boolean
  backup: string | null
  tmux_ok: boolean
  tmux_msg: string
}

export async function saveFile(
  filename: string,
  entries: TinEntry[],
): Promise<SaveResult> {
  return request<SaveResult>(`/api/save/${encodeURIComponent(filename)}`, {
    method: "POST",
    body: JSON.stringify({ entries }),
  })
}

export interface StopAllResult {
  ok: boolean
  results: { class: string; ok: boolean; msg: string }[]
  warning?: string
}

export async function stopAll(): Promise<StopAllResult> {
  return request<StopAllResult>("/api/stop-all", { method: "POST" })
}

export interface ResumeResult {
  ok: boolean
  results: { file: string; ok: boolean; msg: string }[]
}

export async function resume(): Promise<ResumeResult> {
  return request<ResumeResult>("/api/resume", { method: "POST" })
}

export async function getPresets(): Promise<Preset[]> {
  const data = await request<{ ok: boolean; presets: Preset[] }>("/api/presets")
  return data.presets ?? []
}

export async function savePreset(preset: Preset): Promise<Preset[]> {
  const data = await request<{ ok: boolean; presets: Preset[] }>("/api/presets", {
    method: "POST",
    body: JSON.stringify(preset),
  })
  return data.presets ?? []
}

export async function getNotes(): Promise<string> {
  const data = await request<{ ok: boolean; content: string }>("/api/notes")
  return data.content ?? ""
}

export async function saveNotes(content: string): Promise<void> {
  await request("/api/notes", {
    method: "POST",
    body: JSON.stringify({ content }),
  })
}

// ---- 레벨업 통계 ----
export interface LevelEvent {
  at: string
  date: string
  time: string
  level: number
  hp: number
  mp: number
  mv: number
  tr: number
}

export interface CharStats {
  name: string
  count: number
  latest_level: number
  /** 통계는 붙였지만 아직 레벨업 기록이 없음 */
  pending?: boolean
  first_at: string
  last_at: string
  gap_avg_min: number | null
  gap_min_min: number | null
  gap_max_min: number | null
  per_hour: number | null
  today_count: number
  totals: { hp: number; mp: number; mv: number; tr: number }
  avg_per_level: { hp: number; mp: number; mv: number; tr: number }
  daily: { date: string; count: number; hp: number; mp: number; mv: number; tr: number }[]
  hourly: number[]
  events: LevelEvent[]
}

export interface StatsMe {
  from: string
  to: string
  total: number
  characters: CharStats[]
}

export interface OtherPerson {
  name: string
  count: number
  first_at: string
  last_at: string
  gap_avg_min: number | null
  stats_available: boolean
}

export interface StatsOthers {
  from: string
  to: string
  total: number
  people: OtherPerson[]
  note: string
}

function rangeQuery(from?: string, to?: string) {
  const q = new URLSearchParams()
  if (from) q.set("from", from)
  if (to) q.set("to", to)
  const s = q.toString()
  return s ? `?${s}` : ""
}

export async function getStatsMe(from?: string, to?: string): Promise<StatsMe> {
  return request<StatsMe>(`/api/stats/me${rangeQuery(from, to)}`)
}

export async function getStatsOthers(
  from?: string,
  to?: string,
): Promise<StatsOthers> {
  return request<StatsOthers>(`/api/stats/others${rangeQuery(from, to)}`)
}

// ---- 운영 참고서 (docs/*.md) ----
export interface DocMeta {
  name: string
  key: string
  size: number
  mtime: string
}

export interface DocContent extends DocMeta {
  content: string
}

export async function listDocs(): Promise<DocMeta[]> {
  const d = await request<{ ok: boolean; docs: DocMeta[] }>("/api/docs")
  return d.docs ?? []
}

export async function getDoc(key: string): Promise<DocContent> {
  return request<DocContent>(`/api/docs/${encodeURIComponent(key)}`)
}

// ---- tin 파일 관리 (1단계: 읽기 + 편집/저장) ----
// ★이 경로는 서버에서 tmux #read 를 보내지 않는다★
//   저장은 파일 + 백업까지만이고, 게임 세션에는 다음 재접속 때 적용된다.
export interface TinFileMeta {
  /** TIN_DIR 기준 상대경로 (예: 직업/장군.tin) */
  name: string
  /** 상위 폴더 ('' 이면 최상위) */
  dir: string
  /** 폴더 뺀 파일명 */
  base: string
  size: number
  mtime: string
  mtime_raw: number
  has_plain_secret: boolean
  /** 표 편집기(/api/load,/api/save)가 다룰 수 있는 파일인지 (서버 ALLOWED_FILES) */
  table_editable: boolean
  /** 읽기만 되고 저장/이름변경/삭제는 막히는 파일 (main.tin — 부팅 진입점) */
  read_only: boolean
  /** 이 파일을 #read 하는 파일 수. 0이면 지워도 아무것도 안 깨진다 */
  referrer_count: number
}

export interface TinFileContent extends TinFileMeta {
  content: string
}

export interface TinFileSaveResult {
  ok: boolean
  name: string
  size: number
  mtime: string
  mtime_raw: number
  backup: string | null
  backups_removed: string[]
  tmux_sent: boolean
  note: string
}

export async function listTinFiles(): Promise<TinFileMeta[]> {
  const d = await request<{ ok: boolean; files: TinFileMeta[] }>("/api/files")
  return d.files ?? []
}

/** 파일 + 폴더 목록을 함께 받는다 (폴더 트리용) */
export async function listTinTree(): Promise<{
  files: TinFileMeta[]
  dirs: string[]
}> {
  const d = await request<{ ok: boolean; files: TinFileMeta[]; dirs: string[] }>(
    "/api/files",
  )
  return { files: d.files ?? [], dirs: d.dirs ?? [] }
}

export async function createDir(dir: string): Promise<{ dir: string }> {
  return request<{ dir: string }>("/api/dirs/create", {
    method: "POST",
    body: JSON.stringify({ dir }),
  })
}

export async function deleteDir(dir: string): Promise<{ dir: string }> {
  return request<{ dir: string }>("/api/dirs/delete", {
    method: "POST",
    body: JSON.stringify({ dir }),
  })
}

export async function readTinFile(name: string): Promise<TinFileContent> {
  return request<TinFileContent>(`/api/files/${encodeURIComponent(name)}`)
}

export async function saveTinFile(
  name: string,
  content: string,
  mtimeRaw: number,
): Promise<TinFileSaveResult> {
  return request<TinFileSaveResult>(
    `/api/files/save/${encodeURIComponent(name)}`,
    {
      method: "POST",
      body: JSON.stringify({ content, mtime_raw: mtimeRaw }),
    },
  )
}

// ---- 2단계: 참조 조회 / 생성 / 이름변경 / 삭제 (전부 #read 미전송) ----
export interface Referrer {
  source: string
  line: number
  raw: string
}

export interface RefsResult {
  name: string
  referrers: Referrer[]
  referrer_files: string[]
  referrer_count: number
  referrer_lines: number
}

export interface CreateResult {
  name: string
  size: number
  mtime: string
  mtime_raw: number
  note: string
}

export interface RenameResult {
  old_name: string
  name: string
  backup: string | null
  note: string
}

export interface DeleteResult {
  name: string
  trash: string
  in_use_windows: string[]
  in_use_warning: string | null
  note: string
}

export async function getFileRefs(name: string): Promise<RefsResult> {
  return request<RefsResult>(`/api/files/refs/${encodeURIComponent(name)}`)
}

export async function createTinFile(name: string): Promise<CreateResult> {
  return request<CreateResult>("/api/files/create", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export async function renameTinFile(
  name: string,
  newName: string,
): Promise<RenameResult> {
  return request<RenameResult>(
    `/api/files/rename/${encodeURIComponent(name)}`,
    { method: "POST", body: JSON.stringify({ new_name: newName }) },
  )
}

export async function deleteTinFile(name: string): Promise<DeleteResult> {
  return request<DeleteResult>(
    `/api/files/delete/${encodeURIComponent(name)}`,
    { method: "POST", body: JSON.stringify({}) },
  )
}

// ---- 표 편집 (파일관리 경로 — 저장해도 #read 안 나감) ----
export interface ParsedFile {
  name: string
  entries: TinEntry[]
  mtime: string
  mtime_raw: number
  read_only: boolean
  raw_count: number
  editable_count: number
  note: string
}

export async function readParsed(name: string): Promise<ParsedFile> {
  return request<ParsedFile>(`/api/files/parsed/${encodeURIComponent(name)}`)
}

export async function saveParsed(
  name: string,
  entries: TinEntry[],
  mtimeRaw: number,
): Promise<TinFileSaveResult> {
  return request<TinFileSaveResult>(
    `/api/files/save-parsed/${encodeURIComponent(name)}`,
    {
      method: "POST",
      body: JSON.stringify({ entries, mtime_raw: mtimeRaw }),
    },
  )
}

// ---- 파일 이동 (폴더 간) ----
export interface MoveCheck {
  name: string
  read_only: boolean
  movable: boolean
  referrers: Referrer[]
  referrer_files: string[]
  referrer_count: number
  referrer_lines: number
  in_use_windows: string[]
}

export interface MoveResult {
  old_name: string
  name: string
  dir: string
  backup: string | null
  forced: boolean
  broken_refs: Referrer[]
  ref_warning: string | null
  note: string
}

export async function moveCheck(name: string): Promise<MoveCheck> {
  return request<MoveCheck>(`/api/files/move-check/${encodeURIComponent(name)}`)
}

export async function moveTinFile(
  from: string,
  to: string,
  force = false,
): Promise<MoveResult> {
  return request<MoveResult>("/api/files/move", {
    method: "POST",
    body: JSON.stringify({ from, to, force }),
  })
}

// ---- 바로 적용 (살아있는 창에 #read) ----
export interface ApplyCheck {
  name: string
  group: string | null
  session: string
  session_live: boolean
  windows: string[]
  present_windows: string[]
  absent_windows: string[]
  classes: string[]
  /** #session 이 있는 줄 (있으면 차단) */
  risk_sessions: { line: number; text: string }[]
  /** '#' 없는 실행 낱줄 (있으면 확인 필요) */
  risk_bare: { line: number; text: string }[]
  needs_confirm: boolean
  can_send: boolean
  blocked: string | null
  warning: string | null
  note: string | null
}

export interface ApplyResult extends ApplyCheck {
  sent: boolean
  results: {
    window: string
    target: string
    ok: boolean
    killed: { class: string; ok: boolean; error: string | null }[]
    loaded: { action: number; alias: number; other: number }
    summary: string
    delivered: boolean
    response: string[]
    errors: string[]
  }[]
}

export async function applyCheck(name: string): Promise<ApplyCheck> {
  return request<ApplyCheck>(`/api/files/apply-check/${encodeURIComponent(name)}`)
}

export async function applyNow(name: string, force = false): Promise<ApplyResult> {
  return request<ApplyResult>(`/api/files/apply/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify({ force }),
  })
}

// ---- 폴더 이름 변경 ----
export interface DirRenameCheck {
  dir: string
  new_dir: string
  files_inside: string[]
  refs: { file: string; line: number; raw: string; absolute: boolean }[]
  ref_count: number
  exists: boolean
}

export interface DirRenameResult {
  old_dir: string
  dir: string
  files_inside: string[]
  updated_refs: { file: string; line: number; before: string; after: string }[]
  backups: { file: string; backup: string }[]
  note: string
}

export async function dirRenameCheck(dir: string, newDir: string): Promise<DirRenameCheck> {
  return request<DirRenameCheck>("/api/dirs/rename-check", {
    method: "POST",
    body: JSON.stringify({ dir, new_dir: newDir }),
  })
}

export async function dirRename(dir: string, newDir: string): Promise<DirRenameResult> {
  return request<DirRenameResult>("/api/dirs/rename", {
    method: "POST",
    body: JSON.stringify({ dir, new_dir: newDir }),
  })
}

// ---- 명령 직접 전송 (명령 즐겨찾기) ----
export interface SendTarget {
  group: string
  session: string
  window: string
  live: boolean
}

export interface SendResult {
  session: string
  window: string
  group: string
  target: string
  command: string
  sent: boolean
}

export async function sendTargets(): Promise<{ targets: SendTarget[] }> {
  return request<{ targets: SendTarget[] }>("/api/send/targets")
}

export async function sendCommand(
  session: string,
  window: string,
  command: string,
): Promise<SendResult> {
  return request<SendResult>("/api/send", {
    method: "POST",
    body: JSON.stringify({ session, window, command }),
  })
}

// ---- 캐릭터 그룹 ----
export interface GroupStatsChar {
  name: string
  attached: boolean
  has_log: boolean
}

export interface CharGroup {
  name: string
  session: string
  dir: string
  windows: string[]
  /** tmux 세션이 실제로 떠 있는지 */
  live: boolean
  live_windows: string[]
  /** 등록됐지만 실제로 없는 창 */
  missing_windows: string[]
  /** 실제로 있지만 등록되지 않은 창 */
  extra_windows: string[]
  files: string[]
  stats_chars: GroupStatsChar[]
}

export async function fetchGroups(): Promise<{ groups: CharGroup[] }> {
  return request<{ groups: CharGroup[] }>("/api/groups")
}

// ---- 접속 조합 빌더 ----
export interface ComboIssue {
  file: string
  line: number
  kind: string
  message: string
}

export type SessionMode = "file" | "builder"

export interface ComboSession {
  file: string
  line: number
  name: string
  host: string
  port: string
}

export interface ComboValidation {
  ok: boolean
  level: "success" | "warning" | "error"
  checked: string[]
  errors: ComboIssue[]
  warnings: ComboIssue[]
  summary: string
  session_mode: SessionMode
  sessions: ComboSession[]
  /** "파일에 세션 있음" 으로 통과했을 때 쓰일 세션 이름 */
  session_name: string | null
}

export interface ComboSources {
  files: string[]
  defaults: { host: string; port: string; ssh: string; tmux_session: string }
}

export interface ComboResult {
  name: string
  combo: string
  session: string
  host: string
  port: string
  session_mode: SessionMode
  files: string[]
  size: number
  content: string
  backup: string | null
  warnings: ComboIssue[]
  note: string
}

/** 앱이 새 터미널을 띄울 때 쓰는 재료. 서버 주소/계정은 서버 config(.env)에서 온다. */
export interface ConnectInfo {
  mode: "solo" | "group"
  ssh_target: string
  remote: string
  description: string
  combo_path: string
  /** 화면에 보여줄 전체 명령 */
  display: string
}

export interface BatResult {
  mode: string
  filename: string
  content: string
  ssh_target: string
  description: string
}

export async function comboSources(): Promise<ComboSources> {
  return request<ComboSources>("/api/combo/sources")
}

export async function comboValidate(
  files: string[],
  sessionMode: SessionMode,
): Promise<ComboValidation> {
  return request<ComboValidation>("/api/combo/validate", {
    method: "POST",
    body: JSON.stringify({ files, session_mode: sessionMode }),
  })
}

export async function comboCreate(
  name: string,
  files: string[],
  session: string,
  host: string,
  port: string,
  sessionMode: SessionMode,
): Promise<ComboResult> {
  return request<ComboResult>("/api/combo/create", {
    method: "POST",
    body: JSON.stringify({ name, files, session, host, port, session_mode: sessionMode }),
  })
}

export async function comboConnect(
  combo: string,
  session: string,
  mode: "solo" | "group",
): Promise<ConnectInfo> {
  return request<ConnectInfo>("/api/combo/connect", {
    method: "POST",
    body: JSON.stringify({ combo, session, mode }),
  })
}

export async function comboBat(
  combo: string,
  session: string,
  mode: "solo" | "group",
): Promise<BatResult> {
  return request<BatResult>("/api/combo/bat", {
    method: "POST",
    body: JSON.stringify({ combo, session, mode }),
  })
}
