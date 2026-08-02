import { useCallback, useEffect, useState } from "react"
import { FilePlus2, Pencil, Plus, Star, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import {
  EMPTY_SNIPS,
  loadSnips,
  newSnipId,
  removeSnip,
  saveSnips,
  upsertSnip,
  validSnipLabel,
  validSnipText,
  type SnipStore,
  type TextSnip,
} from "@/lib/textsnips"

/**
 * 파일 관리 화면 오른쪽의 "양식 즐겨찾기" 패널.
 *
 * 항목을 누르면 지금 편집 중인 파일에 텍스트를 끼워 넣는다.
 * ★tmux 를 건드리지 않는다★ 게임 전송이 아니라 파일 편집만이다.
 *
 * 실제 삽입은 부모(FilesView)가 가진 textarea 를 알아야 하므로 onInsert 로 위임한다.
 * 여기서는 목록과 관리 UI 만 책임진다.
 */
export function TextSnipsPanel({
  onInsert,
  canInsert,
  onClose,
}: {
  onInsert: (text: string) => void
  /** 파일이 열려 있고 읽기 전용이 아닐 때만 삽입할 수 있다 */
  canInsert: boolean
  onClose: () => void
}) {
  const [store, setStore] = useState<SnipStore>(EMPTY_SNIPS)
  const [edit, setEdit] = useState<TextSnip | null>(null)

  const load = useCallback(async () => {
    try {
      const { store: s, warning } = await loadSnips()
      setStore(s)
      if (warning) toast.warning("양식 즐겨찾기", { description: warning })
    } catch (e) {
      console.info("[양식 즐겨찾기] 불러오기 실패:", e)
      setStore(EMPTY_SNIPS)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const persist = useCallback(async (next: SnipStore) => {
    setStore(next)
    try {
      await saveSnips(next)
    } catch (e) {
      toast.error("저장 실패", { description: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  function startNew() {
    setEdit({ id: newSnipId(), label: "", text: "" })
  }

  function saveEdit() {
    if (!edit) return
    const bad = validSnipLabel(edit.label) ?? validSnipText(edit.text)
    if (bad) {
      toast.error(bad)
      return
    }
    void persist(
      upsertSnip(store, { ...edit, label: edit.label.trim(), text: edit.text.trim() }),
    )
    setEdit(null)
  }

  function insert(s: TextSnip) {
    if (!canInsert) {
      toast.error("먼저 편집할 파일을 열어주세요.")
      return
    }
    onInsert(s.text)
    toast.success(`📄 ${s.label} 삽입됨`)
  }

  const inputCls =
    "tin-mono w-full rounded-md border bg-transparent px-2 py-1 outline-none focus:border-[var(--tin-accent)]"

  return (
    <aside
      className="tin-scroll w-72 shrink-0 overflow-y-auto border-l"
      style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel)" }}
    >
      <div
        className="sticky top-0 flex items-center gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel)" }}
      >
        <Star className="size-3.5 tin-accent" />
        <span className="tin-accent font-semibold" style={{ fontSize: "var(--tin-fs-sm)" }}>
          양식 즐겨찾기
        </span>
        <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>{store.items.length}</span>
        <button onClick={startNew} className="ml-auto rounded p-1 hover:bg-[var(--tin-panel2)]" title="새 양식">
          <Plus className="size-3.5" />
        </button>
        <button onClick={onClose} className="rounded p-1 hover:bg-[var(--tin-panel2)]" title="닫기">
          <X className="size-3.5" />
        </button>
      </div>

      <p className="px-3 py-2 leading-relaxed" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}>
        누르면 <b>지금 열어둔 파일</b>에 끼워 넣습니다. 게임에는 보내지 않습니다.
      </p>

      {!canInsert && (
        <p className="px-3 pb-2" style={{ fontSize: "var(--tin-fs-sm)", color: "#f5a524" }}>
          편집할 파일을 먼저 열어주세요.
        </p>
      )}

      {store.items.length === 0 && !edit && (
        <p className="px-3 pb-3" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>
          아직 없습니다. 위 <b>+</b> 로 추가하세요.
        </p>
      )}

      {store.items.map((s) => (
        <div key={s.id} className="group border-b px-3 py-2" style={{ borderColor: "var(--tin-edge-soft)" }}>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => insert(s)}
              disabled={!canInsert}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:opacity-40"
              title="열어둔 파일에 삽입"
            >
              <FilePlus2 className="size-3.5 shrink-0 tin-accent" />
              <span className="truncate">{s.label}</span>
            </button>
            <button
              onClick={() => setEdit({ ...s })}
              className="shrink-0 rounded p-0.5 opacity-0 hover:bg-[var(--tin-panel2)] group-hover:opacity-100"
              title="수정"
            >
              <Pencil className="size-3" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`"${s.label}" 양식을 지웁니다.`)) void persist(removeSnip(store, s.id))
              }}
              className="shrink-0 rounded p-0.5 opacity-0 hover:bg-[var(--tin-panel2)] group-hover:opacity-100"
              style={{ color: "var(--destructive)" }}
              title="삭제"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
          <pre
            className="tin-mono mt-0.5 overflow-hidden"
            style={{
              fontSize: "var(--tin-fs-sm)",
              opacity: 0.7,
              whiteSpace: "pre-wrap",
              maxHeight: "3.2em",
            }}
          >
            {s.text}
          </pre>
        </div>
      ))}

      {/* 추가 / 수정 */}
      {edit && (
        <div className="m-3 rounded-md border p-3" style={{ borderColor: "var(--tin-edge)", background: "var(--tin-panel2)" }}>
          <label className="block" style={{ fontSize: "var(--tin-fs-sm)" }}>
            이름
            <input
              value={edit.label}
              onChange={(e) => setEdit({ ...edit, label: e.target.value })}
              placeholder="수리"
              className={`${inputCls} mt-0.5`}
              style={{ borderColor: "var(--tin-edge)" }}
            />
          </label>
          <label className="mt-2 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
            삽입할 텍스트 (여러 줄 가능)
            <textarea
              value={edit.text}
              onChange={(e) => setEdit({ ...edit, text: e.target.value })}
              rows={5}
              placeholder={"#alias {수리} {신월도 수리;갑옷 수리;저장;}"}
              className={`${inputCls} mt-0.5`}
              style={{ borderColor: "var(--tin-edge)", resize: "vertical" }}
            />
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
