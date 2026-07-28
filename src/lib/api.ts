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
export interface CharStats {
  name: string
  count: number
  latest_level: number
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
