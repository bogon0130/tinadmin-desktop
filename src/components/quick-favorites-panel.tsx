import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, Monitor, Pencil, Plus, RefreshCw, Send, X } from "lucide-react"
import { toast } from "sonner"

import { activeTarget, sendCommand, type SendTarget } from "@/lib/api"
import {
  EMPTY_STORE,
  loadFavorites,
  newId,
  removeCmd,
  saveFavorites,
  upsertCmd,
  validCmd,
  validCmdLabel,
  type CmdFav,
  type FavStore,
} from "@/lib/favorites"

/**
 * 원클릭 즐겨찾기 패널 (오른쪽 상시 표시).
 *
 * 항목을 누르면 확인창 없이 곧바로 "지금 보고 있는 창"에 명령이 들어간다.
 *
 * ★확인창을 없앤 대신 대상 창을 항상 크게 보여준다★
 *   원클릭은 편한 만큼 잘못 눌렀을 때 되돌릴 수 없다. 어디로 나가는지
 *   패널 맨 위에 항상 띄우고, 창을 못 찾으면 아예 버튼을 잠근다.
 */
export function QuickFavoritesPanel() {
  const [store, setStore] = useState<FavStore>(EMPTY_STORE)
  const [target, setTarget] = useState<SendTarget | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [edit, setEdit] = useState<CmdFav | null>(null)

  const persist = useCallback(async (next: FavStore) => {
    setStore(next)
    try {
      await saveFavorites(next)
    } catch (e) {
      toast.error("저장 실패", { description: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  const load = useCallback(async () => {
    let cur = EMPTY_STORE
    try {
      const { store: s, warning } = await loadFavorites()
      cur = s
      if (warning) toast.warning("즐겨찾기", { description: warning })
    } catch (e) {
      console.info("[즐겨찾기] 불러오기 실패:", e)
    }
    // 예전 quick_commands.json 이관 코드가 여기 있었다. 이관은 이미 끝났고
    // 읽어오던 lib/quickcmds 와 Rust quickcmds_load 커맨드가 제거돼(134e68d)
    // 함께 걷어냈다. 지금은 서버 favorites.json 의 commands 만 쓴다.
    setStore(cur)
  }, [])

  const refreshTarget = useCallback(async () => {
    try {
      const { target: t } = await activeTarget()
      setTarget(t)
    } catch {
      setTarget(null)
    }
  }, [])

  useEffect(() => {
    void load()
    void refreshTarget()
    // 창을 바꿔가며 쓰므로 주기적으로 다시 확인한다
    const id = setInterval(() => void refreshTarget(), 5000)
    return () => clearInterval(id)
  }, [load, refreshTarget])

  /** 원클릭 — 확인창 없이 바로 전송 */
  async function fire(c: CmdFav) {
    if (!target) {
      toast.error("보낼 창을 찾지 못했습니다.")
      return
    }
    setSending(c.id)
    try {
      await sendCommand(target.session, target.window, c.command)
      toast.success(`⚡ ${target.window} ← ${c.label}`, { description: c.command })
    } catch (e) {
      toast.error("전송 실패", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSending(null)
    }
  }

  function save() {
    if (!edit) return
    const bad = validCmdLabel(edit.label) ?? validCmd(edit.command)
    if (bad) {
      toast.error(bad)
      return
    }
    void persist(
      upsertCmd(store, { ...edit, label: edit.label.trim(), command: edit.command.trim() }),
    )
    setEdit(null)
  }

  const inputCls =
    "tin-mono w-full rounded-md border bg-transparent px-2 py-1 outline-none focus:border-[var(--tin-accent)]"

  return (
    <aside
      className="tin-scroll w-64 shrink-0 overflow-y-auto border-l"
      style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel)" }}
    >
      {/* 대상 창 — 원클릭이라 항상 보이게 */}
      <div
        className="sticky top-0 border-b px-3 py-2"
        style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel)" }}
      >
        <div className="flex items-center gap-1.5">
          <Send className="size-3.5 tin-accent" />
          <span className="tin-accent font-semibold" style={{ fontSize: "var(--tin-fs-sm)" }}>
            즐겨찾기
          </span>
          <button
            onClick={() => void refreshTarget()}
            className="ml-auto rounded p-0.5 hover:bg-[var(--tin-panel2)]"
            title="대상 창 다시 확인"
          >
            <RefreshCw className="size-3" />
          </button>
          <button
            onClick={() => setEdit({ id: newId(), label: "", command: "" })}
            className="rounded p-0.5 hover:bg-[var(--tin-panel2)]"
            title="새 즐겨찾기"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Monitor className="size-3 shrink-0" style={{ opacity: 0.6 }} />
          {target ? (
            <span className="tin-mono truncate" style={{ fontSize: "var(--tin-fs-sm)" }}>
              → <b className="tin-accent">{target.window}</b>
              <span style={{ opacity: 0.55 }}> ({target.session})</span>
            </span>
          ) : (
            <span style={{ fontSize: "var(--tin-fs-sm)", color: "var(--destructive)" }}>
              보낼 창 없음
            </span>
          )}
        </div>
      </div>

      {/* 추가 / 수정 — 두 칸만 */}
      {edit && (
        <div className="border-b p-2" style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel2)" }}>
          <input
            autoFocus
            value={edit.label}
            onChange={(e) => setEdit({ ...edit, label: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && setEdit(null)}
            placeholder="이름 (예: 수리가자)"
            className={inputCls}
            style={{ borderColor: "var(--tin-edge)" }}
          />
          <input
            value={edit.command}
            onChange={(e) => setEdit({ ...edit, command: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") save()
              if (e.key === "Escape") setEdit(null)
            }}
            placeholder="명령 (예: 남;남;동;저장)"
            className={`${inputCls} mt-1`}
            style={{ borderColor: "var(--tin-edge)" }}
          />
          <div className="mt-1 flex gap-1">
            <button
              onClick={save}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border py-0.5"
              style={{ borderColor: "var(--tin-accent)", color: "var(--tin-accent)", fontSize: "var(--tin-fs-sm)" }}
            >
              <Check className="size-3" /> 저장
            </button>
            <button
              onClick={() => setEdit(null)}
              className="rounded-md border px-2 py-0.5"
              style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {store.commands.length === 0 && !edit && (
        <p className="px-3 py-3 leading-relaxed" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.65 }}>
          위 <b>+</b> 로 추가하세요.
          <br />
          누르면 <b>바로 전송</b>됩니다 (확인창 없음).
        </p>
      )}

      {/* 목록 — 클릭 한 번에 전송 */}
      {store.commands.map((c) => (
        <div
          key={c.id}
          className="group flex items-center gap-1 border-b px-2 py-1.5"
          style={{ borderColor: "var(--tin-edge-soft)" }}
        >
          <button
            onClick={() => void fire(c)}
            disabled={!target || sending !== null}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:opacity-40"
            title={target ? `${target.window} 창에 "${c.command}" 전송` : "보낼 창 없음"}
          >
            {sending === c.id ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <Send className="size-3.5 shrink-0 tin-accent" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{c.label}</span>
              <span
                className="tin-mono block truncate"
                style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}
              >
                {c.command}
              </span>
            </span>
          </button>
          <button
            onClick={() => setEdit({ ...c })}
            className="shrink-0 rounded p-0.5 opacity-0 hover:bg-[var(--tin-panel2)] group-hover:opacity-100"
            title="수정"
          >
            <Pencil className="size-3" />
          </button>
          <button
            onClick={() => void persist(removeCmd(store, c.id))}
            className="shrink-0 rounded p-0.5 opacity-0 hover:bg-[var(--tin-panel2)] group-hover:opacity-100"
            style={{ color: "var(--destructive)" }}
            title="삭제"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </aside>
  )
}
