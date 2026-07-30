import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import {
  AlertTriangle,
  FilePlus2,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  createTinFile,
  deleteTinFile,
  listTinFiles,
  readTinFile,
  renameTinFile,
  saveTinFile,
  type TinFileContent,
  type TinFileMeta,
} from "@/lib/api"
import {
  CreateDialog,
  DeleteDialog,
  ReadOnlyBadge,
  RenameDialog,
} from "@/components/file-dialogs"
import {
  SNIPPET_FORMS,
  insertSnippet,
  type SnippetForm,
} from "@/lib/snippets"
import { SnippetFormDialog } from "@/components/snippet-form"

/** 실행 중 세션이 쓰는 파일 → 창 이름 (서버 config.FILE_TARGETS 와 같은 내용) */
const IN_USE = new Map<string, string[]>([
  ["한비광.tin", ["한비광"]],
  ["담화린.tin", ["담화린"]],
  ["최상희.tin", ["최상희"]],
  ["초운현.tin", ["초운현"]],
  ["복병.tin", ["복병"]],
  ["공용.tin", ["한비광", "담화린", "최상희", "초운현"]],
  ["stats.tin", ["한비광", "담화린", "최상희"]],
  ["발석차.tin", ["복병"]],
])

function fmtSize(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}

/**
 * tin 파일 관리 (1단계: 읽기 + 편집/저장).
 *
 * ★저장해도 게임 세션에는 반영되지 않는다★
 *   서버의 /api/files/save 는 tmux 로 #read 를 보내지 않는다.
 *   실행 중인 사냥 자반이 저장 즉시 바뀌는 사고를 막기 위한 의도된 동작이고,
 *   실시간 반영은 나중에 별도 "적용" 기능으로 만든다.
 */
export function FilesView() {
  const [files, setFiles] = useState<TinFileMeta[]>([])
  const [current, setCurrent] = useState<TinFileContent | null>(null)
  const [draft, setDraft] = useState("")
  const [loadingList, setLoadingList] = useState(true)
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [dialog, setDialog] = useState<"create" | "rename" | "delete" | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  // textarea 를 한 번이라도 눌렀는지. selectionStart=0(진짜 맨앞 클릭)과
  // "아직 포커스한 적 없음"을 구분하기 위해 따로 추적한다.
  const touchedRef = useRef(false)
  // 열려 있는 양식 폼
  const [snipForm, setSnipForm] = useState<SnippetForm | null>(null)
  // DOM 커밋 직후 복원할 커서 위치 (useLayoutEffect 가 처리)
  const [restoreSel, setRestoreSel] = useState<[number, number] | null>(null)

  const dirty = current !== null && draft !== current.content
  const meta = files.find((f) => f.name === current?.name) ?? null
  const readOnly = meta?.read_only ?? false

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      setFiles(await listTinFiles())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const open = useCallback(
    async (name: string) => {
      if (dirty && !confirm("저장하지 않은 변경이 있습니다. 그래도 열까요?")) return
      setLoadingFile(true)
      setConflict(false)
      try {
        const f = await readTinFile(name)
        setCurrent(f)
        setDraft(f.content)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      } finally {
        setLoadingFile(false)
      }
    },
    [dirty],
  )

  /** 완성된 tin 줄을 커서 위치에 삽입 */
  function insert(snippetText: string) {
    const ta = taRef.current
    // 한 번도 안 눌렀으면 맨끝. 눌렀으면 그 커서 위치를 그대로 쓴다.
    // (버튼에 onMouseDown preventDefault 를 걸어 포커스를 안 뺏기므로 값이 살아있다)
    const selStart = ta && touchedRef.current ? ta.selectionStart : draft.length
    const selEnd = ta && touchedRef.current ? ta.selectionEnd : draft.length
    const r = insertSnippet(draft, selStart, selEnd, snippetText)
    setDraft(r.value)
    // controlled textarea 는 value 가 바뀌면 커서가 리셋된다.
    // rAF 는 React 커밋 전에 돌 수 있어 복원이 덮어써질 수 있으므로,
    // DOM 커밋 직후 실행이 보장되는 useLayoutEffect 로 복원한다.
    setRestoreSel([r.selStart, r.selEnd])
    setSnipForm(null)
  }

  // 삽입 후 커서 복원 — DOM 이 새 value 로 갱신된 다음에 실행된다
  useLayoutEffect(() => {
    if (!restoreSel) return
    const el = taRef.current
    if (el) {
      el.focus()
      el.setSelectionRange(restoreSel[0], restoreSel[1])
      touchedRef.current = true
    }
    setRestoreSel(null)
  }, [restoreSel])

  async function handleSave() {
    if (!current) return
    setSaving(true)
    try {
      const res = await saveTinFile(current.name, draft, current.mtime_raw)
      setCurrent({ ...current, ...res, content: draft })
      setConflict(false)
      toast.success(`✅ 파일 저장됨 — ${res.name}`, {
        description: `백업: ${res.backup ?? "없음"}\n⚠️ 게임엔 미반영 (다음 재접속 때 적용)`,
      })
      await loadList()
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 409) {
        setConflict(true)
        toast.error("다른 곳에서 이 파일이 바뀌었습니다", {
          description: "다시 불러온 뒤 편집해주세요. (덮어쓰지 않았습니다)",
        })
      } else {
        toast.error("저장 실패", { description: err.message })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(name: string) {
    try {
      const res = await createTinFile(name)
      toast.success(`✅ 새 파일 만듦 — ${res.name}`, {
        description: "⚠️ 게임엔 미반영 (다음 재접속 때 적용)",
      })
      setDialog(null)
      await loadList()
      await open(res.name)
    } catch (e) {
      toast.error("만들기 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function handleRename(newName: string) {
    if (!current) return
    try {
      const res = await renameTinFile(current.name, newName)
      toast.success(`✅ 이름 바꿈 — ${res.old_name} → ${res.name}`, {
        description: `백업: ${res.backup ?? "없음"}\n⚠️ 게임엔 미반영`,
      })
      setDialog(null)
      await loadList()
      await open(res.name)
    } catch (e) {
      const err = e as Error & { status?: number }
      toast.error(
        err.status === 409 ? "참조 중이라 이름을 바꿀 수 없습니다" : "이름 변경 실패",
        { description: err.message },
      )
    }
  }

  async function handleDelete() {
    if (!current) return
    try {
      const res = await deleteTinFile(current.name)
      toast.success(`🗑 휴지통으로 옮김 — ${res.name}`, {
        description: res.in_use_warning ?? "되돌리려면 서버의 _trash 폴더에서 꺼내세요.",
      })
      setDialog(null)
      setCurrent(null)
      setDraft("")
      await loadList()
    } catch (e) {
      const err = e as Error & { status?: number }
      toast.error(
        err.status === 409 ? "참조 중이라 삭제할 수 없습니다" : "삭제 실패",
        { description: err.message },
      )
    }
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* 좌측: 파일 목록 */}
      <div
        className="tin-scroll w-64 shrink-0 overflow-y-auto border-r"
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
            tin 파일 {files.length}개
          </span>
          <button
            onClick={() => setDialog("create")}
            title="새 파일 만들기"
            className="ml-auto flex size-6 items-center justify-center rounded hover:bg-[var(--tin-panel2)]"
            style={{ color: "var(--tin-accent)" }}
          >
            <FilePlus2 className="size-3.5" />
          </button>
          <button
            onClick={() => void loadList()}
            title="목록 새로고침"
            className="flex size-6 items-center justify-center rounded hover:bg-[var(--tin-panel2)]"
          >
            {loadingList ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </button>
        </div>

        {files.map((f) => {
          const active = current?.name === f.name
          return (
            <button
              key={f.name}
              onClick={() => void open(f.name)}
              className="block w-full border-b px-3 py-2 text-left transition"
              style={{
                borderColor: "var(--tin-edge-soft)",
                background: active ? "var(--tin-panel2)" : "transparent",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="tin-mono truncate"
                  style={{ color: active ? "var(--tin-accent)" : "var(--tin-fg)" }}
                >
                  {f.name}
                </span>
                {f.has_plain_secret && (
                  <KeyRound
                    className="size-3 shrink-0"
                    style={{ color: "#f5a524" }}
                  />
                )}
                {f.read_only && <Lock className="size-3 shrink-0 opacity-70" />}
              </div>
              <div style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}>
                {fmtSize(f.size)} · {f.mtime.slice(5, 16)}
                {f.referrer_count > 0 && ` · 참조 ${f.referrer_count}`}
              </div>
            </button>
          )
        })}
      </div>

      {/* 우측: 편집기 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 상시 배너 */}
        <div
          className="shrink-0 border-b px-4 py-2 leading-relaxed"
          style={{
            borderColor: "rgb(245 165 36 / 0.35)",
            background: "rgb(245 165 36 / 0.10)",
            fontSize: "var(--tin-fs-sm)",
          }}
        >
          <AlertTriangle
            className="mr-1.5 inline size-3.5"
            style={{ color: "#f5a524" }}
          />
          이 화면의 저장은 <b>파일에만</b> 반영됩니다. 게임 세션에는{" "}
          <b>다음 재접속 때</b> 적용됩니다. (실시간 적용은 다음 단계)
        </div>

        {!current ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}
          >
            {loadingFile ? "불러오는 중…" : "왼쪽에서 파일을 선택하세요."}
          </div>
        ) : (
          <>
            {/* 파일 헤더 */}
            <div
              className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2"
              style={{ borderColor: "var(--tin-edge)" }}
            >
              <span className="tin-accent tin-mono font-semibold">
                {current.name}
              </span>
              <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}>
                {fmtSize(current.size)} · 수정 {current.mtime}
              </span>
              {current.has_plain_secret && (
                <span
                  className="rounded-full border px-2 py-0.5"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    borderColor: "#f5a524",
                    color: "#f5a524",
                  }}
                >
                  평문 비번 있음
                </span>
              )}
              {dirty && (
                <span
                  className="rounded px-2 py-0.5"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    background: "rgb(245 165 36 / 0.18)",
                    color: "#f5a524",
                  }}
                >
                  저장 안 됨
                </span>
              )}
              {readOnly && <ReadOnlyBadge />}
              <div className="ml-auto flex items-center gap-2">
                {meta && !readOnly && (
                  <>
                    <button
                      onClick={() => setDialog("rename")}
                      title="이름 바꾸기"
                      className="flex items-center gap-1 rounded-md border px-2.5 py-1.5"
                      style={{
                        borderColor: "var(--tin-edge)",
                        fontSize: "var(--tin-fs-sm)",
                      }}
                    >
                      <Pencil className="size-3.5" />
                      이름
                    </button>
                    <button
                      onClick={() => setDialog("delete")}
                      title="삭제 (휴지통으로)"
                      className="flex items-center gap-1 rounded-md border px-2.5 py-1.5"
                      style={{
                        borderColor: "rgb(255 95 86 / 0.45)",
                        color: "var(--destructive)",
                        fontSize: "var(--tin-fs-sm)",
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      삭제
                    </button>
                  </>
                )}
                <button
                  onClick={() => void open(current.name)}
                  className="rounded-md border px-3 py-1.5"
                  style={{
                    borderColor: "var(--tin-edge)",
                    fontSize: "var(--tin-fs-sm)",
                  }}
                >
                  다시 불러오기
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || !dirty || readOnly}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold disabled:opacity-50"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    background: "var(--tin-accent)",
                    color: "#06120c",
                  }}
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  저장
                </button>
              </div>
            </div>

            {/* 충돌 안내 */}
            {conflict && (
              <div
                className="shrink-0 border-b px-4 py-2"
                style={{
                  borderColor: "rgb(255 95 86 / 0.4)",
                  background: "rgb(255 95 86 / 0.12)",
                  fontSize: "var(--tin-fs-sm)",
                }}
              >
                다른 곳에서 이 파일이 바뀌었습니다. <b>다시 불러오세요.</b> 지금
                내용을 저장하면 남의 편집을 덮어쓰게 되어 서버가 거부했습니다.
              </div>
            )}

            {/* 양식 삽입 버튼 — tin 문법을 몰라도 빈칸만 채우면 되게 */}
            {!readOnly && (
              <div
                className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-4 py-2"
                style={{ borderColor: "var(--tin-edge)" }}
              >
                <span
                  style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}
                  className="mr-1"
                >
                  양식 넣기
                </span>
                {SNIPPET_FORMS.map((s) => (
                  <button
                    key={s.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSnipForm(s)}
                    title={s.hint}
                    className="rounded-md border px-2.5 py-1 transition hover:border-[var(--tin-accent)]"
                    style={{
                      borderColor: "var(--tin-edge)",
                      fontSize: "var(--tin-fs-sm)",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
                <span
                  className="ml-auto"
                  style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}
                >
                  칸을 채우면 커서 위치에 들어갑니다
                </span>
              </div>
            )}

            <textarea
              ref={taRef}
              onMouseUp={() => (touchedRef.current = true)}
              onKeyUp={() => (touchedRef.current = true)}
              onFocus={() => (touchedRef.current = true)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={readOnly}
              spellCheck={false}
              className="tin-mono tin-scroll min-h-0 flex-1 resize-none border-0 p-4 leading-relaxed outline-none"
              style={{
                background: "var(--tin-bg)",
                color: "var(--tin-fg)",
                whiteSpace: "pre",
              }}
            />
          </>
        )}
      </div>

      {/* 다이얼로그 */}
      {dialog === "create" && (
        <CreateDialog onClose={() => setDialog(null)} onCreate={handleCreate} />
      )}
      {dialog === "rename" && meta && (
        <RenameDialog
          file={meta}
          onClose={() => setDialog(null)}
          onRename={handleRename}
        />
      )}
      {snipForm && (
        <SnippetFormDialog
          form={snipForm}
          onClose={() => setSnipForm(null)}
          onInsert={insert}
        />
      )}

      {dialog === "delete" && meta && (
        <DeleteDialog
          file={meta}
          inUseWindows={IN_USE.get(meta.name) ?? []}
          onClose={() => setDialog(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
