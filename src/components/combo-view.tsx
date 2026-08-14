import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Star,
  FileCheck2,
  PlugZap,
  GripVertical,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

import {
  comboConnect,
  comboCreate,
  comboSources,
  comboValidate,
  type ComboResult,
  type ComboValidation,
  type SessionMode,
} from "@/lib/api"
import {
  allFolders,
  loadFavorites,
  newId,
  saveFavorites,
  upsertItem,
  validName,
  EMPTY_STORE,
  type ConnectMode,
  type FavStore,
} from "@/lib/favorites"

/** 파일 relpath 를 폴더별로 묶는다 */
function groupByDir(files: string[]) {
  const g = new Map<string, string[]>()
  for (const f of files) {
    const i = f.lastIndexOf("/")
    const d = i === -1 ? "" : f.slice(0, i)
    if (!g.has(d)) g.set(d, [])
    g.get(d)!.push(f)
  }
  return g
}

const baseOf = (f: string) => {
  const i = f.lastIndexOf("/")
  return i === -1 ? f : f.slice(i + 1)
}

// 세션 처리 방식 — 항상 "파일에 세션 있음"으로 고정한다(v0.42).
// 0단계 조사에서 실제 캐릭터 tin 은 전부 #session 을 갖고 있음을 확인했다
// (기본.tin/직업별_자반/그룹기본/stats 처럼 #session 이 없는 파일은 전부
// #read 로 캐릭터 파일에 불려들어가는 지원용 파일이라 문제 없음).
const SESSION_MODE: SessionMode = "file"

/**
 * 접속 조합 빌더.
 *
 * tin 여러 개를 골라 순서를 정하고 -> 검증 -> 조합 파일 생성 -> 단독 접속.
 * 서버는 조합 파일을 만들 뿐 tmux 로 아무것도 보내지 않는다.
 *
 * [단독 접속] 이 PC 가 새 터미널 창을 띄워 ssh 로 붙는다 (Rust open_terminal).
 */
export function ComboView({ onFavoriteSaved }: { onFavoriteSaved?: () => void }) {
  const [sources, setSources] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([]) // 순서 = #read 순서
  const [comboName, setComboName] = useState("")
  const [host, setHost] = useState("ggai.tv")
  const [port, setPort] = useState("4000")

  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<ComboValidation | null>(null)
  const [combo, setCombo] = useState<ComboResult | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [preview, setPreview] = useState<{ solo: string; group: string } | null>(null)
  // 즐겨찾기 저장 폼
  const [favOpen, setFavOpen] = useState(false)
  const [favStore, setFavStore] = useState<FavStore>(EMPTY_STORE)
  const [favName, setFavName] = useState("")
  const [favFolder, setFavFolder] = useState("")
  const [favNewFolder, setFavNewFolder] = useState("")
  const [favMode, setFavMode] = useState<ConnectMode>("solo")
  const [favSaving, setFavSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await comboSources()
      setSources(s.files)
      setHost(s.defaults.host)
      setPort(s.defaults.port)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const groups = useMemo(() => groupByDir(sources), [sources])

  function toggle(f: string) {
    setPicked((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]))
    setResult(null)
    setCombo(null)
    setPreview(null)   // 조합이 바뀌면 명령 미리보기도 버린다
  }

  /** 순서 바꾸기 — 드래그로 위/아래 이동 */
  function reorder(from: number, to: number) {
    if (from === to) return
    setPicked((p) => {
      const n = [...p]
      const [m] = n.splice(from, 1)
      n.splice(to, 0, m)
      return n
    })
    setResult(null)
    setCombo(null)
    setPreview(null)   // 조합이 바뀌면 명령 미리보기도 버린다
  }

  async function handleValidate() {
    if (picked.length === 0) {
      toast.error("파일을 하나 이상 골라주세요.")
      return
    }
    setChecking(true)
    try {
      const v = await comboValidate(picked, SESSION_MODE)
      setResult(v)
      if (v.level === "success") toast.success("검증 통과")
      else if (v.level === "warning")
        toast.warning(`경고 ${v.warnings.length}건 — 진행은 가능합니다`)
      else toast.error(`오류 ${v.errors.length}건 — 접속할 수 없습니다`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setChecking(false)
    }
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const c = await comboCreate(
        comboName.trim(), picked, "", host, port, SESSION_MODE,
      )
      setCombo(c)
      void loadPreview(c)
      toast.success(`✅ 조합 만듦 — ${c.name}`, {
        description: "⚠️ 게임엔 미반영. 검증 통과 후 단독 접속으로 붙으세요.",
      })
    } catch (e) {
      toast.error("조합 만들기 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setCreating(false)
    }
  }

  /**
   * 새 터미널 창을 띄워 조합에 접속한다 (단독 전용).
   *
   * 서버는 명령 재료(접속대상 + 원격명령)만 내려주고 ssh 를 실행하지 않는다.
   * 실행은 이 PC 의 Rust 쪽 open_terminal 이 새 콘솔 창을 띄워서 한다.
   */
  async function connect() {
    if (!combo) return
    setConnecting(true)
    try {
      const info = await comboConnect(combo.combo, combo.session, "solo")
      const ran = await invoke<string>("open_terminal", {
        target: info.ssh_target,
        remote: info.remote,
        title: `${combo.session} 단독 — tinadmin`,
        // 접속은 실패할 수 있으므로 창을 남긴다(예전과 같은 동작).
        keep_open: true,
      })
      console.info("[접속] ", ran)
      toast.success("🖥️ 새 터미널 창을 열었습니다 (단독)", {
        description: info.description,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error("접속 실패", {
        description: msg.includes("open_terminal")
          ? "앱(데스크톱)에서만 접속 버튼을 쓸 수 있습니다."
          : msg,
      })
    } finally {
      setConnecting(false)
    }
  }

  async function openFavForm() {
    if (!combo) return
    try {
      const { store } = await loadFavorites()
      setFavStore(store)
    } catch {
      setFavStore(EMPTY_STORE)
    }
    setFavName(combo.combo)
    setFavMode("solo")
    setFavOpen(true)
  }

  async function saveFavorite() {
    if (!combo) return
    const folder = (favNewFolder.trim() || favFolder).trim()
    const badName = validName(favName)
    if (badName) {
      toast.error(badName)
      return
    }
    if (favNewFolder.trim()) {
      const badFolder = validName(favNewFolder)
      if (badFolder) {
        toast.error(badFolder)
        return
      }
    }
    setFavSaving(true)
    try {
      const next = upsertItem(favStore, {
        id: newId(),
        name: favName.trim(),
        combo: combo.combo,
        files: picked,          // 고른 순서 그대로 = #read 순서
        session: combo.session,
        host: combo.host ?? host,
        port: combo.port ?? port,
        sessionMode: SESSION_MODE,
        mode: favMode,
        folder,
        createdAt: new Date().toISOString().slice(0, 10),
      })
      await saveFavorites(next)
      setFavOpen(false)
      setFavNewFolder("")
      toast.success(`⭐ 즐겨찾기에 저장했습니다 — ${favName.trim()}`, {
        description: `${folder || "최상위"} · ${favMode === "group" ? "그룹" : "단독"} 접속`,
      })
      onFavoriteSaved?.()
    } catch (e) {
      toast.error("즐겨찾기 저장 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setFavSaving(false)
    }
  }

  /** 화면에 보여줄 명령 미리보기 (생성 직후 두 모드 다 받아둔다) */
  const loadPreview = useCallback(async (c: ComboResult) => {
    try {
      const [solo, group] = await Promise.all([
        comboConnect(c.combo, c.session, "solo"),
        comboConnect(c.combo, c.session, "group"),
      ])
      setPreview({ solo: solo.display, group: group.display })
    } catch {
      setPreview(null)
    }
  }, [])

  // "파일에 세션 있음" 고정이므로 검증이 찾아낸 세션 이름이 있어야 만들 수 있다.
  const canCreate =
    result?.ok === true &&
    comboName.trim() !== "" &&
    !!result.session_name

  // 검증을 통과하고 조합이 만들어진 상태에서만 접속할 수 있다
  const canConnect = !!combo && result?.ok === true

  const inputCls =
    "tin-mono rounded-md border bg-transparent px-3 py-1.5 outline-none focus:border-[var(--tin-accent)]"
  const inputStyle = { borderColor: "var(--tin-edge)" }

  return (
    <div className="flex min-h-0 flex-1">
      {/* 좌측: 파일 고르기 */}
      <div
        className="tin-scroll w-72 shrink-0 overflow-y-auto border-r"
        style={{ borderColor: "var(--tin-edge)" }}
      >
        <div
          className="flex items-center gap-2 border-b px-3 py-2.5"
          style={{ borderColor: "var(--tin-edge)" }}
        >
          <span
            className="tin-accent font-semibold tracking-wide"
            style={{ fontSize: "var(--tin-fs-sm)" }}
          >
            조합할 파일 고르기
          </span>
          <button
            onClick={() => void load()}
            className="ml-auto flex size-6 items-center justify-center rounded hover:bg-[var(--tin-panel2)]"
            title="목록 새로고침"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </button>
        </div>

        {[...groups.keys()].sort().map((d) => (
          <div key={d || "__root__"}>
            <div
              className="border-b px-3 py-1.5"
              style={{
                borderColor: "var(--tin-edge)",
                background: "var(--tin-panel2)",
                fontSize: "var(--tin-fs-sm)",
                color: "var(--tin-accent)",
              }}
            >
              {d === "" ? "최상위" : d}
            </div>
            {groups.get(d)!.map((f) => (
              <label
                key={f}
                className="flex cursor-pointer items-center gap-2 border-b px-3 py-1.5"
                style={{ borderColor: "var(--tin-edge-soft)" }}
              >
                <input
                  type="checkbox"
                  checked={picked.includes(f)}
                  onChange={() => toggle(f)}
                  className="size-3.5"
                  style={{ accentColor: "var(--tin-accent)" }}
                />
                <span className="tin-mono truncate">{baseOf(f)}</span>
                {picked.includes(f) && (
                  <span
                    className="tin-accent ml-auto"
                    style={{ fontSize: "var(--tin-fs-sm)" }}
                  >
                    {picked.indexOf(f) + 1}
                  </span>
                )}
              </label>
            ))}
          </div>
        ))}
      </div>

      {/* 우측: 순서 + 설정 + 검증 + 결과 */}
      <div className="tin-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <div
          className="mb-4 rounded-md border px-3 py-2 leading-relaxed"
          style={{
            borderColor: "rgb(245 165 36 / 0.35)",
            background: "rgb(245 165 36 / 0.10)",
            fontSize: "var(--tin-fs-sm)",
          }}
        >
          <AlertTriangle className="mr-1.5 inline size-3.5" style={{ color: "#f5a524" }} />
          조합 파일을 만들 뿐 <b>지금 도는 세션은 건드리지 않습니다.</b>
        </div>

        {/* 순서 */}
        <p className="hud-sect">READ ORDER · 읽는 순서 (위 → 아래)</p>
        {picked.length === 0 ? (
          <p
            className="mb-4 rounded-md border px-3 py-4 text-center"
            style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}
          >
            왼쪽에서 파일을 고르세요. 고른 순서가 #read 순서가 됩니다.
          </p>
        ) : (
          <div className="mb-4 space-y-1">
            {picked.map((f, i) => (
              <div
                key={f}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIdx !== null) reorder(dragIdx, i)
                  setDragIdx(null)
                }}
                onDragEnd={() => setDragIdx(null)}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5"
                style={{
                  borderColor: "var(--tin-edge)",
                  background: "var(--tin-panel2)",
                  opacity: dragIdx === i ? 0.45 : 1,
                  cursor: "grab",
                }}
              >
                <GripVertical className="size-3.5 shrink-0 opacity-60" />
                <span className="tin-accent" style={{ fontSize: "var(--tin-fs-sm)" }}>
                  {i + 1}
                </span>
                <span className="tin-mono truncate">{f}</span>
                <button
                  onClick={() => toggle(f)}
                  className="ml-auto shrink-0 rounded px-1.5"
                  style={{ fontSize: "var(--tin-fs-sm)", color: "var(--destructive)" }}
                >
                  빼기
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 설정 */}
        <p className="hud-sect">SESSION · 접속 설정</p>

        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <label style={{ fontSize: "var(--tin-fs-sm)" }}>
            조합 이름 (파일명)
            <input
              value={comboName}
              onChange={(e) => setComboName(e.target.value)}
              placeholder="장군조합"
              className={`${inputCls} mt-1 w-full`}
              style={inputStyle}
            />
          </label>

          {/* 파일이 세션을 갖고 있으므로(세션 항상 file 고정), 검증이 찾아낸 세션을 보여준다 */}
          <div style={{ fontSize: "var(--tin-fs-sm)" }}>
            세션 (파일에서 가져옴)
            <div
              className="tin-mono mt-1 w-full rounded-md border px-3 py-1.5"
              style={{
                borderColor: "var(--tin-edge)",
                opacity: result?.session_name ? 1 : 0.55,
              }}
            >
              {result?.session_name
                ? `#session {${result.session_name}}  ← ${result.sessions[0]?.file}:${result.sessions[0]?.line}`
                : "검증하면 여기에 표시됩니다"}
            </div>
          </div>
        </div>

        {/* 검증 + 생성 */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => void handleValidate()}
            disabled={checking || picked.length === 0}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 disabled:opacity-50"
            style={{ borderColor: "var(--tin-accent)", color: "var(--tin-accent)", fontSize: "var(--tin-fs-sm)" }}
          >
            {checking ? <Loader2 className="size-3.5 animate-spin" /> : <FileCheck2 className="size-3.5" />}
            접속 검증
          </button>
          <button
            onClick={() => void handleCreate()}
            disabled={!canCreate || creating}
            title={!result?.ok ? "먼저 검증을 통과해야 합니다" : ""}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold disabled:opacity-40"
            style={{ background: "var(--tin-accent)", color: "#06120c", fontSize: "var(--tin-fs-sm)" }}
          >
            {creating && <Loader2 className="size-3.5 animate-spin" />}
            조합 만들기
          </button>
        </div>

        {/* 검증 결과 */}
        {result && (
          <div
            className="mb-4 rounded-md border p-3"
            style={{
              borderColor:
                result.level === "success"
                  ? "var(--tin-accent)"
                  : result.level === "warning"
                    ? "rgb(245 165 36 / 0.5)"
                    : "rgb(255 95 86 / 0.5)",
              background:
                result.level === "success"
                  ? "rgb(var(--tin-accent-rgb) / 0.10)"
                  : result.level === "warning"
                    ? "rgb(245 165 36 / 0.10)"
                    : "rgb(255 95 86 / 0.12)",
            }}
          >
            <div className="mb-2 flex items-center gap-1.5 font-semibold">
              {result.level === "success" ? (
                <CheckCircle2 className="size-4" style={{ color: "var(--tin-accent)" }} />
              ) : result.level === "warning" ? (
                <AlertTriangle className="size-4" style={{ color: "#f5a524" }} />
              ) : (
                <XCircle className="size-4" style={{ color: "var(--destructive)" }} />
              )}
              {result.summary}
            </div>

            {result.errors.length > 0 && (
              <ul className="tin-mono mb-2 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: "var(--tin-fs-sm)", color: "var(--destructive)" }}>
                    {e.file}:{e.line} — {e.message}
                  </li>
                ))}
              </ul>
            )}
            {result.warnings.length > 0 && (
              <ul className="tin-mono space-y-0.5">
                {result.warnings.map((w, i) => (
                  <li key={i} style={{ fontSize: "var(--tin-fs-sm)", color: "#f5a524" }}>
                    {w.file}:{w.line} — {w.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 생성 결과 */}
        {combo && (
          <>
            <p className="hud-sect">RESULT · 생성된 조합</p>
            <div
              className="mb-3 rounded-md border p-3"
              style={{ borderColor: "var(--tin-edge)" }}
            >
              <div className="tin-mono mb-2 tin-accent">{combo.name}</div>
              <pre
                className="tin-mono tin-scroll overflow-x-auto rounded-md border p-2.5 leading-relaxed"
                style={{
                  borderColor: "var(--tin-edge)",
                  background: "var(--tin-panel2)",
                  whiteSpace: "pre",
                  fontSize: "var(--tin-fs-sm)",
                }}
              >
                {combo.content}
              </pre>
            </div>

            {/* 접속 — 새 터미널 창을 띄운다 (단독 전용) */}
            <p className="hud-sect">CONNECT · 바로 접속</p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={() => void connect()}
                disabled={!canConnect || connecting}
                title={
                  canConnect
                    ? undefined
                    : "검증을 통과한 조합만 접속할 수 있습니다."
                }
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 disabled:opacity-40"
                style={{
                  borderColor: "var(--tin-accent)",
                  color: "var(--tin-accent)",
                  fontSize: "var(--tin-fs-sm)",
                }}
              >
                {connecting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <PlugZap className="size-3.5" />
                )}
                단독 접속
              </button>
              <span
                className="self-center"
                style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}
              >
                새 터미널 창이 열립니다.
              </span>
            </div>

            {/* 즐겨찾기 저장 — 검증 통과 + 조합 생성 상태에서만 */}
            <div className="mb-3">
              <button
                onClick={() => void openFavForm()}
                disabled={!canConnect}
                title={canConnect ? undefined : "검증을 통과한 조합만 저장할 수 있습니다."}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 disabled:opacity-40"
                style={{
                  borderColor: "var(--tin-accent)",
                  color: "var(--tin-accent)",
                  fontSize: "var(--tin-fs-sm)",
                }}
              >
                <Star className="size-3.5" />
                즐겨찾기에 저장
              </button>

              {favOpen && (
                <div
                  className="mt-2 grid gap-2 rounded-md border p-3 sm:grid-cols-2"
                  style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel2)" }}
                >
                  <label style={{ fontSize: "var(--tin-fs-sm)" }}>
                    즐겨찾기 이름
                    <input
                      value={favName}
                      onChange={(e) => setFavName(e.target.value)}
                      className={`${inputCls} mt-1 w-full`}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ fontSize: "var(--tin-fs-sm)" }}>
                    폴더 (없으면 최상위)
                    <select
                      value={favFolder}
                      onChange={(e) => setFavFolder(e.target.value)}
                      disabled={favNewFolder.trim() !== ""}
                      className={`${inputCls} mt-1 w-full disabled:opacity-40`}
                      style={inputStyle}
                    >
                      <option value="">— 최상위 —</option>
                      {allFolders(favStore).map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ fontSize: "var(--tin-fs-sm)" }}>
                    새 폴더 만들기 (선택)
                    <input
                      value={favNewFolder}
                      onChange={(e) => setFavNewFolder(e.target.value)}
                      placeholder="비워두면 위에서 고른 폴더"
                      className={`${inputCls} mt-1 w-full`}
                      style={inputStyle}
                    />
                  </label>

                  <div style={{ fontSize: "var(--tin-fs-sm)" }}>
                    접속 방식 (저장 시점에 고정)
                    <div className="mt-1 flex gap-2">
                      {(["solo", "group"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setFavMode(m)}
                          className="flex-1 rounded-md border px-2 py-1.5"
                          style={{
                            borderColor: favMode === m ? "var(--tin-accent)" : "var(--tin-edge)",
                            color: favMode === m ? "var(--tin-accent)" : "var(--tin-fg)",
                          }}
                        >
                          {m === "solo" ? "단독" : "그룹"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      onClick={() => void saveFavorite()}
                      disabled={favSaving}
                      className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 disabled:opacity-50"
                      style={{
                        borderColor: "var(--tin-accent)",
                        color: "var(--tin-accent)",
                        fontSize: "var(--tin-fs-sm)",
                      }}
                    >
                      {favSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Star className="size-3.5" />}
                      저장
                    </button>
                    <button
                      onClick={() => setFavOpen(false)}
                      className="rounded-md border px-3 py-1.5"
                      style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 실행될 명령 — 직접 붙여 쓰고 싶은 사람을 위해 그대로 보여준다 */}
            {preview && (
              <div className="mb-3 grid gap-2">
                {(["solo", "group"] as const).map((m) => (
                  <div key={m}>
                    <div
                      className="mb-1 flex items-center gap-2"
                      style={{ fontSize: "var(--tin-fs-sm)" }}
                    >
                      <span style={{ opacity: 0.7 }}>
                        {m === "solo" ? "단독" : "그룹"} 명령
                      </span>
                      <button
                        onClick={() => {
                          void navigator.clipboard.writeText(preview[m])
                          toast.success("📋 명령을 복사했습니다")
                        }}
                        className="flex items-center gap-1 rounded border px-1.5"
                        style={{ borderColor: "var(--tin-edge)" }}
                      >
                        <Copy className="size-3" />
                        복사
                      </button>
                    </div>
                    <pre
                      className="tin-mono tin-scroll overflow-x-auto rounded-md border p-2"
                      style={{
                        borderColor: "var(--tin-edge)",
                        background: "var(--tin-panel2)",
                        whiteSpace: "pre",
                        fontSize: "var(--tin-fs-sm)",
                      }}
                    >
                      {preview[m]}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
