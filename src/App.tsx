import { useCallback, useEffect, useState } from "react"
import {
  AlarmClock,
  BarChart3,
  BookOpen,
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
import {
  ACCENT_PRESETS,
  DEFAULT_THEME,
  FONT_OPTIONS,
  applyTheme,
  loadTheme,
  saveTheme,
  type ThemeSettings,
} from "@/lib/theme"
import type { TableType, TinEntry } from "@/lib/types"
import { LoginScreen } from "@/components/login-screen"
import { EntryTable } from "@/components/entry-table"
import { Cheatsheet } from "@/components/cheatsheet"
import { RawView } from "@/components/raw-view"
import { PresetsView } from "@/components/presets-view"
import { NotesView } from "@/components/notes-view"
import { StatsView } from "@/components/stats-view"
import { ReferencePanel } from "@/components/reference-panel"

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
  // 참고서 패널 — 기본은 접힘 (필요할 때 상단 버튼으로 펼침)
  const [showRef, setShowRef] = useState(false)
  const [urlDraft, setUrlDraft] = useState(getApiUrl())
  const [themeDraft, setThemeDraft] = useState<ThemeSettings>(() => loadTheme())

  // 저장된 화면 설정을 시작할 때 적용 (다음 실행에도 유지)
  useEffect(() => {
    applyTheme(loadTheme())
  }, [])

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
              setThemeDraft(loadTheme())
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
              onClick={() => setShowRef((v) => !v)}
              title="운영 참고서 (서버 docs/참고서.md)"
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition"
              style={{
                borderColor: showRef ? "var(--tin-accent)" : "var(--tin-edge)",
                color: showRef ? "var(--tin-accent)" : "var(--tin-fg)",
              }}
            >
              <BookOpen className="size-3.5" />
              참고서
            </button>
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
              {/* 참고서를 펼치면 치트시트는 접는다 (좁은 화면에서 표가 눌리지 않게) */}
              {!showRef && <Cheatsheet type={view} />}
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

          {/* 우측 고정 참고 패널 — 기본은 접힘, 상단 [참고서] 버튼으로 토글 */}
          {showRef && <ReferencePanel onClose={() => setShowRef(false)} />}
        </div>
      </div>

      {/* 설정 모달 */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="hud-panel tin-scroll max-h-[88vh] w-full max-w-lg overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="tin-accent mb-4 font-semibold tracking-wide"
              style={{ fontSize: "var(--tin-fs-lg)" }}
            >
              설정
            </h3>

            {/* 서버 */}
            <p className="hud-sect">SERVER · 서버</p>
            <label className="mb-1.5 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
              API 주소
            </label>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              spellCheck={false}
              className="tin-mono mb-4 w-full rounded-md border border-[var(--tin-edge)] bg-transparent px-3 py-2 outline-none focus:border-[var(--tin-accent)]"
            />

            {/* 화면 */}
            <p className="hud-sect">DISPLAY · 화면</p>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
                  글자색
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeDraft.textColor}
                    onChange={(e) =>
                      setThemeDraft({ ...themeDraft, textColor: e.target.value })
                    }
                    className="h-8 w-10 cursor-pointer rounded border border-[var(--tin-edge)] bg-transparent"
                  />
                  <input
                    value={themeDraft.textColor}
                    onChange={(e) =>
                      setThemeDraft({ ...themeDraft, textColor: e.target.value })
                    }
                    className="tin-mono w-full rounded-md border border-[var(--tin-edge)] bg-transparent px-2 py-1.5 outline-none focus:border-[var(--tin-accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
                  강조색
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeDraft.accentColor}
                    onChange={(e) =>
                      setThemeDraft({ ...themeDraft, accentColor: e.target.value })
                    }
                    className="h-8 w-10 cursor-pointer rounded border border-[var(--tin-edge)] bg-transparent"
                  />
                  <input
                    value={themeDraft.accentColor}
                    onChange={(e) =>
                      setThemeDraft({ ...themeDraft, accentColor: e.target.value })
                    }
                    className="tin-mono w-full rounded-md border border-[var(--tin-edge)] bg-transparent px-2 py-1.5 outline-none focus:border-[var(--tin-accent)]"
                  />
                </div>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() =>
                    setThemeDraft({ ...themeDraft, accentColor: p.value })
                  }
                  className="rounded-md border px-2.5 py-1"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    borderColor:
                      themeDraft.accentColor.toLowerCase() === p.value
                        ? p.value
                        : "var(--tin-edge)",
                    color: p.value,
                  }}
                >
                  ● {p.label}
                </button>
              ))}
            </div>

            <label className="mb-1.5 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
              폰트 종류
            </label>
            <select
              value={themeDraft.fontFamily}
              onChange={(e) =>
                setThemeDraft({ ...themeDraft, fontFamily: e.target.value })
              }
              className="mb-3 w-full rounded-md border border-[var(--tin-edge)] bg-[var(--tin-panel2)] px-2 py-2 outline-none focus:border-[var(--tin-accent)]"
              style={{ fontSize: "var(--tin-fs-sm)" }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <label className="mb-1.5 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
              글자 크기 — {themeDraft.fontSize}px
              <span style={{ opacity: 0.7 }}> (한글 고정폭은 +1px)</span>
            </label>
            <input
              type="range"
              min={11}
              max={22}
              step={1}
              value={themeDraft.fontSize}
              onChange={(e) =>
                setThemeDraft({
                  ...themeDraft,
                  fontSize: Number(e.target.value),
                })
              }
              className="mb-3 w-full accent-[var(--tin-accent)]"
            />

            {/* 미리보기 */}
            <div
              className="hud-gauge mb-4"
              style={{
                fontFamily: themeDraft.fontFamily,
                color: themeDraft.textColor,
              }}
            >
              <div
                style={{
                  fontSize: `${themeDraft.fontSize + 1}px`,
                }}
              >
                미리보기 · 한글 ABC 0123{" "}
                <span style={{ color: themeDraft.accentColor }}>
                  ← 강조색
                </span>
              </div>
              <div className="hud-bar mt-2">
                <i
                  style={{
                    width: "62%",
                    background: `linear-gradient(90deg, ${themeDraft.accentColor}55, ${themeDraft.accentColor})`,
                    boxShadow: `0 0 12px ${themeDraft.accentColor}8c`,
                  }}
                />
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <button
                onClick={() => {
                  setThemeDraft({ ...DEFAULT_THEME })
                  applyTheme(DEFAULT_THEME)
                }}
                className="rounded-md border border-[var(--tin-edge)] px-3 py-1.5 transition hover:border-[var(--tin-accent)]"
                style={{ fontSize: "var(--tin-fs-sm)" }}
              >
                기본값
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // 취소하면 저장된 값으로 되돌린다
                    const saved = loadTheme()
                    setThemeDraft(saved)
                    applyTheme(saved)
                    setShowSettings(false)
                  }}
                  className="rounded-md border border-[var(--tin-edge)] px-3 py-1.5 transition hover:border-[var(--tin-accent)]"
                  style={{ fontSize: "var(--tin-fs-sm)" }}
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    setApiUrl(urlDraft)
                    saveTheme(themeDraft)
                    applyTheme(themeDraft)
                    setShowSettings(false)
                    toast.success("설정 저장됨", {
                      description: "다음 실행 때도 유지됩니다.",
                    })
                    void load(file)
                  }}
                  className="rounded-md px-3 py-1.5 font-semibold"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    background: "var(--tin-accent)",
                    color: "#06120c",
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  )
}
