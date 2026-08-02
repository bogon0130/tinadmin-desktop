import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Plus, Send, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { sendCommand, sendTargets, type SendTarget } from "@/lib/api"
import {
  EMPTY_QUICK,
  loadQuick,
  newQuickId,
  removeQuick,
  saveQuick,
  upsertQuick,
  validCommand,
  validLabel,
  type QuickCmd,
  type QuickStore,
} from "@/lib/quickcmds"

/**
 * 오른쪽 "명령 즐겨찾기" 패널.
 *
 * 항목을 누르면 확인창을 거쳐 살아있는 창에 명령 한 줄을 그대로 보낸다.
 * ★#read 가 아니다★ 사용자가 직접 친 것처럼 들어가므로 대상 창을 반드시 보여주고
 *   확인을 받는다. 서버도 세션/창/문자를 다시 검증한다.
 */
export function QuickCommandsPanel({ onClose }: { onClose: () => void }) {
  const [store, setStore] = useState<QuickStore>(EMPTY_QUICK)
  const [targets, setTargets] = useState<SendTarget[]>([])
  const [sending, setSending] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<QuickCmd | null>(null)
  const [edit, setEdit] = useState<QuickCmd | null>(null)

  const load = useCallback(async () => {
    try {
      const { store: s, warning } = await loadQuick()
      setStore(s)
      if (warning) toast.warning("명령 즐겨찾기", { description: warning })
    } catch (e) {
      console.info("[명령 즐겨찾기] 불러오기 실패:", e)
      setStore(EMPTY_QUICK)
    }
    try {
      const t = await sendTargets()
      setTargets(t.targets)
    } catch {
      setTargets([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const liveMap = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const t of targets) m.set(`${t.session}/${t.window}`, t.live)
    return m
  }, [targets])

  const persist = useCallback(async (next: QuickStore) => {
    setStore(next)
    try {
      await saveQuick(next)
    } catch (e) {
      toast.error("저장 실패", { description: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  async function doSend(q: QuickCmd) {
    setSending(q.id)
    try {
      const r = await sendCommand(q.session, q.window, q.command)
      toast.success(`⚡ ${r.window} 창에 전송`, { description: r.command })
      setConfirm(null)
    } catch (e) {
      toast.error("전송 실패", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSending(null)
    }
  }

  function startNew() {
    const first = targets.find((t) => t.live) ?? targets[0]
    setEdit({
      id: newQuickId(),
      label: "",
      command: "",
      session: first?.session ?? "",
      window: first?.window ?? "",
    })
  }

  function saveEdit() {
    if (!edit) return
    const bad = validLabel(edit.label) ?? validCommand(edit.command)
    if (bad) {
      toast.error(bad)
      return
    }
    if (!edit.session || !edit.window) {
      toast.error("보낼 창을 골라주세요.")
      return
    }
    void persist(upsertQuick(store, { ...edit, label: edit.label.trim(), command: edit.command.trim() }))
    setEdit(null)
  }

  const inputCls =
    "tin-mono w-full rounded-md border bg-transparent px-2 py-1 outline-none focus:border-[var(--tin-accent)]"

  return (
    <aside
      className="tin-scroll w-80 shrink-0 overflow-y-auto border-l"
      style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel)" }}
    >
      <div
        className="sticky top-0 flex items-center gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel)" }}
      >
        <Send className="size-3.5 tin-accent" />
        <span className="tin-accent font-semibold" style={{ fontSize: "var(--tin-fs-sm)" }}>
          명령 즐겨찾기
        </span>
        <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>{store.items.length}</span>
        <button onClick={startNew} className="ml-auto rounded p-1 hover:bg-[var(--tin-panel2)]" title="새 항목">
          <Plus className="size-3.5" />
        </button>
        <button onClick={onClose} className="rounded p-1 hover:bg-[var(--tin-panel2)]" title="닫기">
          <X className="size-3.5" />
        </button>
      </div>

      <p className="px-3 py-2 leading-relaxed" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}>
        누르면 <b>살아있는 창에 명령이 그대로</b> 들어갑니다. 파일을 읽는 게 아니라
        직접 친 것과 같으니 대상 창을 확인하세요.
      </p>

      {store.items.length === 0 && !edit && (
        <p className="px-3 pb-3" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>
          아직 없습니다. 위 <b>+</b> 로 추가하세요.
        </p>
      )}

      {/* 목록 */}
      {store.items.map((q) => {
        const live = liveMap.get(`${q.session}/${q.window}`)
        return (
          <div key={q.id} className="group border-b px-3 py-2" style={{ borderColor: "var(--tin-edge-soft)" }}>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setConfirm(q)}
                disabled={sending !== null}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:opacity-50"
                title={`${q.session} / ${q.window} 에 전송`}
              >
                {sending === q.id ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin" />
                ) : (
                  <Send className="size-3.5 shrink-0 tin-accent" />
                )}
                <span className="truncate">{q.label}</span>
              </button>
              <button
                onClick={() => setEdit({ ...q })}
                className="shrink-0 rounded p-0.5 opacity-0 hover:bg-[var(--tin-panel2)] group-hover:opacity-100"
                title="수정"
              >
                <Pencil className="size-3" />
              </button>
              <button
                onClick={() => {
                  if (confirmDelete(q.label)) void persist(removeQuick(store, q.id))
                }}
                className="shrink-0 rounded p-0.5 opacity-0 hover:bg-[var(--tin-panel2)] group-hover:opacity-100"
                style={{ color: "var(--destructive)" }}
                title="삭제"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
            <div className="tin-mono mt-0.5 truncate" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.75 }}>
              {q.command}
            </div>
            <div style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>
              {q.session} / {q.window}
              {live === false && <b style={{ color: "var(--destructive)" }}> · 창 없음</b>}
            </div>
          </div>
        )
      })}

      {/* 전송 확인 */}
      {confirm && (
        <div className="m-3 rounded-md border p-3" style={{ borderColor: "var(--tin-accent)", background: "var(--tin-panel2)" }}>
          <p style={{ fontSize: "var(--tin-fs-sm)" }}>
            <b className="tin-mono">{confirm.command}</b>
            <br />→ <b className="tin-accent">{confirm.session}</b> 세션 /{" "}
            <b className="tin-accent">{confirm.window}</b> 창에 전송합니다.
          </p>
          {liveMap.get(`${confirm.session}/${confirm.window}`) === false && (
            <p style={{ fontSize: "var(--tin-fs-sm)", color: "var(--destructive)" }}>
              ⛔ 그 창이 떠 있지 않습니다.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void doSend(confirm)}
              disabled={sending !== null || liveMap.get(`${confirm.session}/${confirm.window}`) === false}
              className="flex items-center gap-1 rounded-md border px-3 py-1 disabled:opacity-40"
              style={{ borderColor: "var(--tin-accent)", color: "var(--tin-accent)", fontSize: "var(--tin-fs-sm)" }}
            >
              <Send className="size-3.5" /> 전송
            </button>
            <button
              onClick={() => setConfirm(null)}
              className="rounded-md border px-3 py-1"
              style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 추가 / 수정 */}
      {edit && (
        <div className="m-3 rounded-md border p-3" style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel2)" }}>
          <label className="block" style={{ fontSize: "var(--tin-fs-sm)" }}>
            이름
            <input
              value={edit.label}
              onChange={(e) => setEdit({ ...edit, label: e.target.value })}
              placeholder="자동저장"
              className={`${inputCls} mt-0.5`}
              style={{ borderColor: "var(--tin-edge)" }}
            />
          </label>
          <label className="mt-2 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
            보낼 명령
            <input
              value={edit.command}
              onChange={(e) => setEdit({ ...edit, command: e.target.value })}
              placeholder="저장"
              className={`${inputCls} mt-0.5`}
              style={{ borderColor: "var(--tin-edge)" }}
            />
          </label>
          <label className="mt-2 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
            보낼 창
            <select
              value={`${edit.session}/${edit.window}`}
              onChange={(e) => {
                const [session, window] = e.target.value.split("/")
                setEdit({ ...edit, session, window })
              }}
              className={`${inputCls} mt-0.5`}
              style={{ borderColor: "var(--tin-edge)" }}
            >
              {targets.map((t) => (
                <option key={`${t.session}/${t.window}`} value={`${t.session}/${t.window}`}>
                  {t.group} · {t.window} ({t.session}){t.live ? "" : " — 없음"}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 flex gap-2">
            <button
              onClick={saveEdit}
              className="rounded-md border px-3 py-1"
              style={{ borderColor: "var(--tin-accent)", color: "var(--tin-accent)", fontSize: "var(--tin-fs-sm)" }}
            >
              저장
            </button>
            <button
              onClick={() => setEdit(null)}
              className="rounded-md border px-3 py-1"
              style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}

function confirmDelete(label: string): boolean {
  return window.confirm(`"${label}" 명령 즐겨찾기를 지웁니다.`)
}
