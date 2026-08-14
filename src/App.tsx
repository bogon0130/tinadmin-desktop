import { useEffect, useState } from "react"
import {
  BarChart3,
  BookOpen,
  BookText,
  FolderCog,
  GraduationCap,
  Plug,
  LogOut,
  Settings,
  Star,
  Swords,
  Terminal,
} from "lucide-react"
import { Toaster, toast } from "sonner"

import {
  clearToken,
  getApiUrl,
  getToken,
  setApiUrl,
} from "@/lib/api"
import {
  ACCENT_PRESETS,
  DEFAULT_THEME,
  FONT_OPTIONS,
  applyTheme,
  loadTheme,
  saveTheme,
  type ThemeSettings,
} from "@/lib/theme"
import { LoginScreen } from "@/components/login-screen"
import { usePanelWidth } from "@/lib/persist"
import { NotesView } from "@/components/notes-view"
import { StatsView } from "@/components/stats-view"
import { FilesView } from "@/components/files-view"
import { ComboView } from "@/components/combo-view"
import { GroupView } from "@/components/groups/group-view"
import { GuideView } from "@/components/guide-view"
import { FavoritesView } from "@/components/favorites-view"
import { ItemsView } from "@/components/items-view"
import { applyUiBase } from "@/lib/ui-base"

type ViewId =
  | "favorites"
  | "guide"
  | "notes"
  | "stats"
  | "files"
  | "combo"
  | "items"
  | "doc-한비광그룹"
  | "doc-천마신군그룹"

/** 그룹 대시보드 메뉴 id -> 그룹명 */
const GROUP_VIEWS: Record<string, string> = {
  "doc-한비광그룹": "한비광그룹",
  "doc-천마신군그룹": "천마신군그룹",
}

type MenuItem = { id: ViewId; label: string; icon: typeof BookOpen }

/** 왼쪽 메뉴 — 전부 항상 펼쳐져 있다 */
const MENU: MenuItem[] = [
  // 클릭 한 번으로 저장된 방식대로 접속한다 — 가장 자주 쓰므로 맨 위
  { id: "favorites", label: "즐겨찾기", icon: Star },
  // 그룹별 대시보드
  { id: "doc-한비광그룹", label: "한비광그룹", icon: BookOpen },
  { id: "doc-천마신군그룹", label: "천마신군그룹", icon: BookOpen },
  { id: "files", label: "파일 관리", icon: FolderCog },
  { id: "combo", label: "접속 빌더", icon: Plug },
  { id: "items", label: "아이템 도감", icon: Swords },
  { id: "stats", label: "통계", icon: BarChart3 },
  { id: "notes", label: "정보 저장소", icon: BookText },
  { id: "guide", label: "사용법", icon: GraduationCap },
]

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))
  const [view, setView] = useState<ViewId>("favorites")
  // 접속 빌더에서 즐겨찾기를 저장하면 이 값을 올려 목록을 다시 읽게 한다
  const [favReload, setFavReload] = useState(0)
  // 왼쪽 사이드바 폭 — 경계를 끌어 조절하고 재시작해도 유지된다.
  // 기본값은 최대한 축소된 상태(min)로 시작한다 — 콘텐츠 영역을 넓게 쓰기 위함.
  const [navW, setNavW] = usePanelWidth("tin.nav.width", 200, 200, 560)
  const [showSettings, setShowSettings] = useState(false)
  const [urlDraft, setUrlDraft] = useState(getApiUrl())
  const [themeDraft, setThemeDraft] = useState<ThemeSettings>(() => loadTheme())
  // 저장된 화면 설정을 시작할 때 적용 (다음 실행에도 유지)
  useEffect(() => {
    applyTheme(loadTheme())
    // 확정된 색/폰트로 덮어쓴다 (옛 설정이 localStorage 에 남아 있어도)
    applyUiBase()
  }, [])

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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* 사이드바 */}
      <nav
        className="relative flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
        style={{ width: navW }}
      >
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Terminal className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">KIM BO GON</div>
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[10px] text-muted-foreground">
                tt++ 고블린 자반 프로그램
              </span>
              {/* 버전은 package.json 에서 빌드 시점에 박힌다 (vite define) */}
              <span
                title={`tinadmin-desktop v${__APP_VERSION__}`}
                className="shrink-0 rounded-full border border-border px-1.5 py-px text-[9px] leading-normal text-muted-foreground"
              >
                v{__APP_VERSION__}
              </span>
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

        {/* 오른쪽 경계 — 끌어서 폭 조절 */}
        <div
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startW = navW
            const move = (ev: MouseEvent) => setNavW(startW + (ev.clientX - startX))
            const up = () => {
              window.removeEventListener("mousemove", move)
              window.removeEventListener("mouseup", up)
              document.body.style.cursor = ""
              document.body.style.userSelect = ""
            }
            // 드래그 중 글자가 선택되면 커서가 튀므로 잠시 막는다
            document.body.style.cursor = "col-resize"
            document.body.style.userSelect = "none"
            window.addEventListener("mousemove", move)
            window.addEventListener("mouseup", up)
          }}
          onDoubleClick={() => setNavW(288)}
          title="끌어서 폭 조절 (두 번 누르면 기본값)"
          className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-[var(--primary)]"
          style={{ opacity: 0.5 }}
        />
      </nav>

      {/* 본문 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 상단 고정 바 */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-5 py-3">
          <h2 className="text-sm font-semibold">
            {MENU.find((m) => m.id === view)?.label}
          </h2>
        </header>

        {/* 콘텐츠 — 항상 한 칸이다.
            화면별로 옆에 패널을 덧붙이던 걸 없앴다(UI 개편 1단계). 각 뷰는
            이 한 칸 안에서 완결되어야 하고, 필요한 보조 정보는 뷰 내부에서
            카드로 쌓는다. */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {view === "favorites" && <FavoritesView reloadKey={favReload} />}
          {view === "notes" && <NotesView />}
          {view === "stats" && <StatsView />}
          {view === "files" && <FilesView />}
          {view === "combo" && (
            <ComboView onFavoriteSaved={() => setFavReload((n) => n + 1)} />
          )}
          {view === "guide" && <GuideView />}
          {view === "items" && <ItemsView />}
          {GROUP_VIEWS[view] && (
            <GroupView key={view} groupName={GROUP_VIEWS[view]} />
          )}
        </main>
      </div>

      {/* 설정 모달 */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
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
