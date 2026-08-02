import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, BarChart3, CheckCircle2, FileText, Loader2, Monitor, RefreshCw, StickyNote, XCircle } from "lucide-react"
import { toast } from "sonner"

import { fetchGroups, type CharGroup } from "@/lib/api"
import {
  EMPTY_NOTES,
  getNote,
  loadNotes,
  saveNotes,
  setNote,
  validNote,
  type NoteStore,
} from "@/lib/charnotes"

/**
 * 캐릭터 그룹 화면.
 *
 * 어떤 그룹이 어느 tmux 세션의 어느 창으로 떠 있는지, 그 그룹의 tin 파일과
 * 레벨업 통계가 어떻게 붙어 있는지를 한눈에 본다.
 *
 * ★읽기 전용이다★ 이 화면은 tmux 에 아무 명령도 보내지 않는다.
 *   살아있는 창 목록만 조회해서 보여준다.
 */
export function GroupsView({ onOpenFile }: { onOpenFile?: (name: string) => void }) {
  const [groups, setGroups] = useState<CharGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<NoteStore>(EMPTY_NOTES)
  /** 지금 메모를 펼쳐 편집 중인 캐릭터 */
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetchGroups()
      setGroups(d.groups)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadNoteStore = useCallback(async () => {
    try {
      const { store, warning } = await loadNotes()
      setNotes(store)
      if (warning) toast.warning("캐릭터 메모", { description: warning })
    } catch {
      setNotes(EMPTY_NOTES)
    }
  }, [])

  useEffect(() => {
    void load()
    void loadNoteStore()
  }, [load, loadNoteStore])

  async function commitNote(name: string) {
    const bad = validNote(draft)
    if (bad) {
      toast.error(bad)
      return
    }
    const next = setNote(notes, name, draft)
    setNotes(next)
    setEditing(null)
    try {
      await saveNotes(next)
    } catch (e) {
      toast.error("메모 저장 실패", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="tin-accent font-semibold" style={{ fontSize: "var(--tin-fs-sm)" }}>
          캐릭터 그룹
        </span>
        <button
          onClick={() => void load()}
          className="ml-auto flex items-center gap-1 rounded-md border px-2 py-1"
          style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          새로고침
        </button>
      </div>

      <p className="mb-4" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}>
        캐릭터별 메모를 적어두고, 연결된 tin 을 눌러 파일 관리에서 바로 엽니다.
        <br />tmux 에는 아무 명령도 보내지 않습니다. <b>↳</b> 는 #read 로 딸려오는 파일입니다.
      </p>

      {groups.map((g) => (
        <div
          key={g.name}
          className="mb-4 rounded-md border p-3"
          style={{ borderColor: "var(--tin-edge)" }}
        >
          {/* 머리말 */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="tin-accent font-semibold">{g.name}</span>
            <span className="tin-mono rounded px-1.5" style={{ background: "var(--tin-panel2)", fontSize: "var(--tin-fs-sm)" }}>
              tmux: {g.session}
            </span>
            {g.live ? (
              <span className="flex items-center gap-1" style={{ fontSize: "var(--tin-fs-sm)", color: "var(--tin-accent)" }}>
                <CheckCircle2 className="size-3.5" /> 실행 중
              </span>
            ) : (
              <span className="flex items-center gap-1" style={{ fontSize: "var(--tin-fs-sm)", color: "var(--destructive)" }}>
                <XCircle className="size-3.5" /> 세션 없음
              </span>
            )}
            {g.dir && (
              <span className="tin-mono ml-auto" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>
                tin/{g.dir}/
              </span>
            )}
          </div>

          {/* 캐릭터 카드 — 메모 + 연결된 tin */}
          <p className="hud-sect">
            <Monitor className="mr-1 inline size-3" />
            캐릭터 {g.characters.length}명
          </p>
          <div className="mb-3 grid gap-2">
            {g.characters.map((c) => {
              const note = getNote(notes, c.name)
              const open_ = editing === c.name
              return (
                <div
                  key={c.name}
                  className="rounded-md border p-2"
                  style={{
                    borderColor: c.live ? "var(--tin-edge)" : "var(--destructive)",
                    background: "var(--tin-panel2)",
                    opacity: c.live ? 1 : 0.75,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tin-mono tin-accent font-semibold">{c.name}</span>
                    {!c.live && (
                      <span style={{ fontSize: "var(--tin-fs-sm)", color: "var(--destructive)" }}>
                        창 없음
                      </span>
                    )}
                    {c.has_stats && (
                      <span
                        className="rounded px-1.5"
                        style={{ fontSize: "var(--tin-fs-sm)", border: "1px solid var(--tin-edge)" }}
                        title={c.stats_logged ? "기록이 쌓이고 있음" : "아직 레벨업 기록 없음"}
                      >
                        통계 {c.stats_logged ? "기록 있음" : "대기"}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEditing(open_ ? null : c.name)
                        setDraft(note)
                      }}
                      className="ml-auto flex items-center gap-1 rounded border px-2 py-0.5"
                      style={{
                        borderColor: note ? "var(--tin-accent)" : "var(--tin-edge)",
                        color: note ? "var(--tin-accent)" : "var(--tin-fg)",
                        fontSize: "var(--tin-fs-sm)",
                      }}
                      title="메모 / 할일"
                    >
                      <StickyNote className="size-3" />
                      메모{note ? " ●" : ""}
                    </button>
                  </div>

                  {/* 연결된 tin — 누르면 파일 관리에서 열린다 */}
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>tin:</span>
                    {c.files.length === 0 ? (
                      <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>연결된 파일 없음</span>
                    ) : (
                      c.files.map((f) => (
                        <button
                          key={f}
                          onClick={() => onOpenFile?.(f)}
                          className="tin-mono rounded px-1.5 underline-offset-2 hover:underline"
                          style={{
                            fontSize: "var(--tin-fs-sm)",
                            background: "var(--tin-bg)",
                            color: "var(--tin-accent)",
                          }}
                          title={`파일 관리에서 ${f} 열기${
                            c.direct_files.includes(f) ? "" : " (#read 로 딸려오는 파일)"
                          }`}
                        >
                          {f.includes("/") ? f.slice(f.lastIndexOf("/") + 1) : f}
                          {!c.direct_files.includes(f) && (
                            <span style={{ opacity: 0.6 }}> ↳</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* 메모 — 펼쳤을 때만 편집 */}
                  {open_ ? (
                    <div className="mt-2">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={4}
                        placeholder="해결할 문제, 고칠 것 등을 적어두세요"
                        className="tin-mono w-full rounded-md border bg-transparent px-2 py-1 outline-none focus:border-[var(--tin-accent)]"
                        style={{ borderColor: "var(--tin-edge)", resize: "vertical" }}
                      />
                      <div className="mt-1 flex gap-2">
                        <button
                          onClick={() => void commitNote(c.name)}
                          className="rounded-md border px-3 py-0.5"
                          style={{ borderColor: "var(--tin-accent)", color: "var(--tin-accent)", fontSize: "var(--tin-fs-sm)" }}
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded-md border px-3 py-0.5"
                          style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    note && (
                      <pre
                        className="mt-1 rounded px-2 py-1"
                        style={{
                          fontSize: "var(--tin-fs-sm)",
                          background: "var(--tin-bg)",
                          whiteSpace: "pre-wrap",
                          opacity: 0.85,
                        }}
                      >
                        {note}
                      </pre>
                    )
                  )}
                </div>
              )
            })}
          </div>

          {g.extra_windows.length > 0 && (
            <p className="mb-3 flex items-start gap-1" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.75 }}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                등록되지 않은 창이 이 세션에 떠 있습니다:{" "}
                <b className="tin-mono">{g.extra_windows.join(", ")}</b>
              </span>
            </p>
          )}

          {/* 통계 */}
          <p className="hud-sect">
            <BarChart3 className="mr-1 inline size-3" />
            레벨업 통계
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {g.stats_chars.length === 0 ? (
              <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>붙어 있는 캐릭터 없음</span>
            ) : (
              g.stats_chars.map((c) => (
                <span
                  key={c.name}
                  className="tin-mono rounded border px-2 py-0.5"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    borderColor: "var(--tin-edge)",
                    opacity: c.has_log ? 1 : 0.6,
                  }}
                  title={c.has_log ? "기록이 쌓이고 있음" : "아직 레벨업 기록 없음 (다음 레벨업부터 집계)"}
                >
                  {c.name} {c.has_log ? "· 기록 있음" : "· 기록 대기"}
                </span>
              ))
            )}
          </div>

          {/* 파일 */}
          <p className="hud-sect">
            <FileText className="mr-1 inline size-3" />
            tin 파일 {g.files.length}개
          </p>
          <div className="flex flex-wrap gap-1.5">
            {g.files.map((f) => (
              <span
                key={f}
                className="tin-mono rounded px-1.5"
                style={{ background: "var(--tin-panel2)", fontSize: "var(--tin-fs-sm)" }}
              >
                {f.includes("/") ? f.slice(f.lastIndexOf("/") + 1) : f}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
