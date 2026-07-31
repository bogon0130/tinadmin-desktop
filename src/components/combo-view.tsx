import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  GripVertical,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import {
  comboBat,
  comboCreate,
  comboSources,
  comboValidate,
  type ComboResult,
  type ComboValidation,
  type SessionMode,
} from "@/lib/api"

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

/**
 * 접속 조합 빌더.
 *
 * tin 여러 개를 골라 순서를 정하고 -> 검증 -> 조합 파일 생성 -> .bat 다운로드.
 * 서버는 조합 파일을 만들 뿐 tmux 로 아무것도 보내지 않는다.
 * 실제 접속은 받은 .bat 이 ssh 로 들어가서 한다.
 */
export function ComboView() {
  const [sources, setSources] = useState<string[]>([])
  const [defaults, setDefaults] = useState({
    host: "ggai.tv",
    port: "4000",
    ssh: "",
    tmux_session: "goblin",
  })
  const [picked, setPicked] = useState<string[]>([]) // 순서 = #read 순서
  const [comboName, setComboName] = useState("")
  const [session, setSession] = useState("")
  const [host, setHost] = useState("ggai.tv")
  const [port, setPort] = useState("4000")
  const [mode, setMode] = useState<"solo" | "group">("solo")
  // 세션을 누가 만드느냐. 기본은 "파일에 있는 걸 쓴다" —
  // 캐릭터 tin 은 대개 자기 #session 을 갖고 있어서, 빌더가 또 만들면 ALREADY 오류가 난다.
  const [sessionMode, setSessionMode] = useState<SessionMode>("file")

  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState<ComboValidation | null>(null)
  const [combo, setCombo] = useState<ComboResult | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await comboSources()
      setSources(s.files)
      setDefaults(s.defaults)
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

  function changeSessionMode(m: SessionMode) {
    setSessionMode(m)
    setResult(null)   // 판정 기준이 달라지므로 검증 결과를 버린다
    setCombo(null)
  }

  function toggle(f: string) {
    setPicked((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]))
    setResult(null)
    setCombo(null)
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
  }

  async function handleValidate() {
    if (picked.length === 0) {
      toast.error("파일을 하나 이상 골라주세요.")
      return
    }
    setChecking(true)
    try {
      const v = await comboValidate(picked, sessionMode)
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
        comboName.trim(), picked, session.trim(), host, port, sessionMode,
      )
      setCombo(c)
      toast.success(`✅ 조합 만듦 — ${c.name}`, {
        description: "⚠️ 게임엔 미반영. 받은 .bat 으로 접속하세요.",
      })
    } catch (e) {
      toast.error("조합 만들기 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setCreating(false)
    }
  }

  async function downloadBat(m: "solo" | "group") {
    if (!combo) return
    try {
      const b = await comboBat(combo.combo, combo.session, m)
      // 브라우저/웹뷰에서 파일로 저장
      const blob = new Blob([b.content], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = b.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`💾 ${b.filename} 저장됨`, { description: b.description })
    } catch (e) {
      toast.error(".bat 만들기 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // "파일에 세션 있음" 이면 세션 이름을 입력받지 않는다 — 검증이 파일에서 찾아준다.
  const canCreate =
    result?.ok === true &&
    comboName.trim() !== "" &&
    (sessionMode === "file" ? !!result.session_name : session.trim() !== "")

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
          조합 파일을 만들 뿐 <b>지금 도는 세션은 건드리지 않습니다.</b> 접속은 아래에서
          받은 <b>.bat</b> 으로 하세요.
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

        {/* 세션 처리 방식 — 이걸 잘못 고르면 세션이 둘이 되어 ALREADY 오류가 난다 */}
        <div
          className="mb-3 rounded-md border p-3"
          style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel2)" }}
        >
          <p className="mb-2" style={{ fontSize: "var(--tin-fs-sm)", color: "var(--tin-accent)" }}>
            세션 처리 방식
          </p>
          {(
            [
              {
                v: "file" as const,
                t: "파일에 세션 있음 (기본)",
                d: "고른 파일 안의 #session 을 그대로 쓴다. 빌더는 #config + #read 만 만든다.",
              },
              {
                v: "builder" as const,
                t: "빌더가 세션 생성",
                d: "빌더가 위에 #session {이름} {서버} {포트} 를 넣는다. 파일에 #session 이 없을 때 쓴다.",
              },
            ]
          ).map((o) => (
            <label
              key={o.v}
              className="flex cursor-pointer items-start gap-2 py-1"
              style={{ fontSize: "var(--tin-fs-sm)" }}
            >
              <input
                type="radio"
                name="session-mode"
                checked={sessionMode === o.v}
                onChange={() => changeSessionMode(o.v)}
                className="mt-0.5 accent-[var(--tin-accent)]"
              />
              <span>
                <span style={{ color: sessionMode === o.v ? "var(--tin-accent)" : undefined }}>
                  {o.t}
                </span>
                <span className="block" style={{ opacity: 0.65 }}>
                  {o.d}
                </span>
              </span>
            </label>
          ))}
        </div>

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

          {sessionMode === "builder" ? (
            <>
              <label style={{ fontSize: "var(--tin-fs-sm)" }}>
                세션 이름
                <input
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  placeholder="담신우"
                  className={`${inputCls} mt-1 w-full`}
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: "var(--tin-fs-sm)" }}>
                게임 서버
                <input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className={`${inputCls} mt-1 w-full`}
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: "var(--tin-fs-sm)" }}>
                포트
                <input
                  value={port}
                  onChange={(e) => setPort(e.target.value.replace(/[^\d]/g, ""))}
                  className={`${inputCls} mt-1 w-full`}
                  style={inputStyle}
                />
              </label>
            </>
          ) : (
            /* 파일이 세션을 갖고 있으므로 입력칸을 숨기고, 검증이 찾아낸 세션을 보여준다 */
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
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span style={{ fontSize: "var(--tin-fs-sm)" }}>접속 모드</span>
          {(["solo", "group"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="rounded-md border px-3 py-1.5"
              style={{
                fontSize: "var(--tin-fs-sm)",
                borderColor: mode === m ? "var(--tin-accent)" : "var(--tin-edge)",
                color: mode === m ? "var(--tin-accent)" : "var(--tin-fg)",
              }}
            >
              {m === "solo" ? "단독" : `그룹 (${defaults.tmux_session} 에 새 창)`}
            </button>
          ))}
          <span className="ml-auto tin-mono" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}>
            ssh {defaults.ssh}
          </span>
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

        {/* 생성 결과 + .bat */}
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

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void downloadBat("solo")}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5"
                style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
              >
                <Download className="size-3.5" />
                .bat 다운로드 (단독)
              </button>
              <button
                onClick={() => void downloadBat("group")}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5"
                style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
              >
                <Download className="size-3.5" />
                .bat 다운로드 (그룹)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
