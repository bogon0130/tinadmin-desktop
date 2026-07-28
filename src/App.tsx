import { useCallback, useEffect, useState } from "react"
import {
  AlarmClock,
  BarChart3,
  BookText,
  Boxes,
  EyeOff,
  FileCode2,
  Highlighter,
  Keyboard,
  Loader2,
  LogOut,
  OctagonX,
  Play,
  Replace,
  Save,
  Settings,
  Terminal,
  Variable,
  Wand2,
  Zap,
} from "lucide-react"
import { Toaster, toast } from "sonner"

import {
  clearToken,
  getApiUrl,
  getToken,
  loadFile,
  resume,
  saveFile,
  setApiUrl,
  stopAll,
} from "@/lib/api"
import { TYPE_META } from "@/lib/tin-utils"
import type { TableType, TinEntry } from "@/lib/types"
import { LoginScreen } from "@/components/login-screen"
import { EntryTable } from "@/components/entry-table"
import { Cheatsheet } from "@/components/cheatsheet"
import { RawView } from "@/components/raw-view"
import { PresetsView } from "@/components/presets-view"
import { NotesView } from "@/components/notes-view"
import { StatsView } from "@/components/stats-view"

const FILES = ["한비광.tin", "공용.tin"]

type ViewId = TableType | "presets" | "notes" | "raw" | "stats"

const MENU: { id: ViewId; label: string; icon: typeof Zap }[] = [
  { id: "action", label: "자반", icon: Zap },
  { id: "alias", label: "줄임말", icon: Wand2 },
  { id: "variable", label: "변수", icon: Variable },
  { id: "substitute", label: "치환", icon: Replace },
  { id: "highlight", label: "하이라이트", icon: Highlighter },
  { id: "gag", label: "가그", icon: EyeOff },
  { id: "macro", label: "매크로", icon: Keyboard },
  { id: "ticker", label: "타이머", icon: AlarmClock },
  { id: "class", label: "클래스", icon: Boxes },
  { id: "presets", label: "캐릭터 프리셋", icon: Boxes },
  { id: "notes", label: "정보 저장소", icon: BookText },
  { id: "stats", label: "통계", icon: BarChart3 },
  { id: "raw", label: "Raw 편집", icon: FileCode2 },
]

function isTableType(v: ViewId): v is TableType {
  return v in TYPE_META
}

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))
  const [view, setView] = useState<ViewId>("action")
  const [file, setFile] = useState(FILES[0])
  const [entries, setEntries] = useState<TinEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [urlDraft, setUrlDraft] = useState(getApiUrl())

  const load = useCallback(async (target: string) => {
    setLoading(true)
    try {
      const list = await loadFile(target)
      setEntries(list)
      setDirty(false)
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 401) {
        clearToken()
        setAuthed(false)
        toast.error("로그인이 만료되었습니다. 다시 접속하세요.")
      } else {
        toast.error(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) void load(file)
  }, [authed, file, load])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await saveFile(file, entries)
      setDirty(false)
      toast.success(
        res.tmux_ok ? "저장 완료 — tt++에 반영됨" : "저장 완료 (tmux 반영 실패)",
        {
          description: res.tmux_ok
            ? `백업: ${res.backup?.split("/").pop() ?? "없음"}`
            : res.tmux_msg,
        },
      )
      await load(file)
    } catch (e) {
      toast.error("저장 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleStopAll() {
    if (
      !confirm("정말 전체 중지할까요?\n등록된 클래스의 자반이 모두 제거됩니다.")
    )
      return
    try {
      const res = await stopAll()
      if (res.warning) {
        toast.warning("중지할 클래스가 없습니다", { description: res.warning })
      } else {
        toast.success("전체 중지 명령 전송됨", {
          description: res.results.map((r) => r.class).join(", "),
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleResume() {
    try {
      const res = await resume()
      toast.success("되살리기 완료", {
        description: res.results.map((r) => r.file).join(", "),
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  function handleLogout() {
    clearToken()
    setAuthed(false)
  }

  if (!authed) {
    return (
      <>
        <LoginScreen onLoggedIn={() => setAuthed(true)} />
        <Toaster theme="dark" position="bottom-right" richColors />
      </>
    )
  }

  const usesFile = view !== "presets" && view !== "notes" && view !== "stats"

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* 사이드바 */}
      <nav className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Terminal className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">tinadmin</div>
            <div className="truncate text-[10px] text-muted-foreground">
              tt++ 자반 관리자
            </div>
          </div>
        </div>

        <div className="tin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {MENU.map((m) => {
            const Icon = m.icon
            const active = view === m.id
            return (
              <button
                key={m.id}
                onClick={() => setView(m.id)}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition ${
                  active
                    ? "bg-sidebar-accent font-semibold text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            )
          })}
        </div>

        <div className="border-t border-sidebar-border p-2">
          <button
            onClick={() => {
              setUrlDraft(getApiUrl())
              setShowSettings(true)
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground transition hover:bg-sidebar-accent/60"
          >
            <Settings className="size-4" /> 설정
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground transition hover:bg-sidebar-accent/60"
          >
            <LogOut className="size-4" /> 로그아웃
          </button>
        </div>
      </nav>

      {/* 본문 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 상단 고정 바 */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-5 py-3">
          <h2 className="text-sm font-semibold">
            {MENU.find((m) => m.id === view)?.label}
          </h2>

          {usesFile && (
            <>
              <select
                value={file}
                onChange={(e) => {
                  if (
                    dirty &&
                    !confirm("저장하지 않은 변경이 있습니다. 그래도 바꿀까요?")
                  )
                    return
                  setFile(e.target.value)
                }}
                className="font-mono-tin rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              >
                {FILES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              {dirty && (
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">
                  저장 안 됨
                </span>
              )}
              {loading && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}

              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                저장
              </button>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleStopAll}
              className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
            >
              <OctagonX className="size-3.5" />
              전체중지
            </button>
            <button
              onClick={handleResume}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-secondary"
            >
              <Play className="size-3.5" />
              되살리기
            </button>
          </div>
        </header>

        {/* 콘텐츠 */}
        <div className="flex min-h-0 flex-1">
          {isTableType(view) && (
            <>
              <EntryTable
                type={view}
                entries={entries}
                onChange={(next) => {
                  setEntries(next)
                  setDirty(true)
                }}
              />
              <Cheatsheet type={view} />
            </>
          )}
          {view === "raw" && (
            <RawView
              entries={entries}
              onChange={(next) => {
                setEntries(next)
                setDirty(true)
              }}
            />
          )}
          {view === "presets" && (
            <PresetsView currentFile={file} entries={entries} />
          )}
          {view === "notes" && <NotesView />}
          {view === "stats" && <StatsView />}
        </div>
      </div>

      {/* 설정 모달 */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-sm font-semibold">설정</h3>
            <label className="mb-1.5 block text-xs text-muted-foreground">
              서버 API 주소
            </label>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              spellCheck={false}
              className="font-mono-tin mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
              기본값은{" "}
              <span className="font-mono-tin">https://tin.bogon.kr</span> 이다.
              서버가 127.0.0.1 로만 열려 있어 외부에서는 Cloudflare 터널 주소로만
              접속된다.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs transition hover:bg-secondary"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setApiUrl(urlDraft)
                  setShowSettings(false)
                  toast.success("서버 주소 저장됨")
                  void load(file)
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  )
}
