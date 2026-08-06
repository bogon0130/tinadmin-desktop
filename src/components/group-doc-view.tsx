import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, MonitorPlay, Pencil, RefreshCw, Save, Terminal } from "lucide-react"
import { toast } from "sonner"

import { getDoc, saveDoc, type DocContent } from "@/lib/api"
import { renderMarkdown } from "@/lib/markdown"
import { parseGroupSummary } from "@/lib/group-doc"

/**
 * 그룹별 운영 참고서 화면 (한비광그룹 / 천마신군그룹).
 *
 * 내용은 앱에 하드코딩하지 않고 서버 docs/<이름>.md 에서 받아온다 — 문서를
 * 고칠 때 앱을 다시 빌드하지 않아도 되게 하려는 것이고, 여기서는 한 발 더
 * 나아가 앱 안에서 바로 고쳐 저장한다(POST /api/docs/<이름>).
 *
 * 보기 ↔ 편집을 토글로 나눈 이유: 평소엔 렌더된 문서를 읽고, 고칠 때만
 * 원문(마크다운)을 연다. 편집 중에는 저장/취소가 명확히 보여야 실수로
 * 날리지 않는다.
 */
export function GroupDocView({ docKey }: { docKey: string }) {
  const [doc, setDoc] = useState<DocContent | null>(null)
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 상단 요약 — 문서에서 읽어올 뿐 문서를 고치지 않는다.
  // 못 찾으면 조용히 비고, 그때는 메뉴 이름을 제목으로 쓴다.
  const summary = useMemo(() => parseGroupSummary(doc?.content ?? ""), [doc])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await getDoc(docKey)
      setDoc(d)
      setDraft(d.content)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [docKey])

  // 메뉴를 옮기면 docKey 가 바뀐다. 편집 중이던 초안은 남기지 않는다.
  useEffect(() => {
    setEditing(false)
    void load()
  }, [load])

  async function handleSave() {
    setBusy(true)
    try {
      const d = await saveDoc(docKey, draft)
      setDoc(d)
      setDraft(d.content)
      setEditing(false)
      toast.success(`${docKey} 저장됨`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const dirty = doc !== null && draft !== doc.content

  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      {/* 그룹 요약 — 세션명과 창 수는 재접속할 때 매번 확인하는 값이라 늘 보이게 둔다.
          커맨드센터 패널(cc-panel)과 같은 면·뱃지를 쓴다. */}
      <div className="cc-panel mb-4 shrink-0">
        <div className="cc-head" style={{ marginBottom: 0 }}>
          <span className="cc-dot on" />
          <span className="cc-name">{summary.title || docKey}</span>
          <span className="cc-badge ok">GROUP</span>
        </div>

        <div className="cc-tags" style={{ marginTop: 10, marginBottom: 0 }}>
          {summary.session && (
            <span className="cc-tag" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Terminal className="size-3" />
              SESSION
              <b style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
                {summary.session}
              </b>
            </span>
          )}
          {summary.windows !== null && (
            <span className="cc-tag" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <MonitorPlay className="size-3" />
              WINDOWS
              <b style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
                {summary.windows}
              </b>
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <p className="text-[12px] text-muted-foreground">
          서버 <code className="font-mono-tin">docs/{docKey}.md</code> 를 보여준다.
          여기서 고치면 앱을 다시 설치하지 않아도 바로 반영된다.
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => void load()}
            disabled={loading || busy}
            title="서버에서 다시 불러오기"
            className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs transition hover:bg-sidebar-accent/60 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            새로고침
          </button>

          {editing ? (
            <>
              <button
                onClick={() => {
                  setDraft(doc?.content ?? "")
                  setEditing(false)
                }}
                disabled={busy}
                className="rounded-md border border-input px-2.5 py-1.5 text-xs transition hover:bg-sidebar-accent/60 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={busy || !dirty}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                저장
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              disabled={loading || !doc}
              className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs transition hover:bg-sidebar-accent/60 disabled:opacity-50"
            >
              <Pencil className="size-3.5" />
              편집
            </button>
          )}
        </div>
      </div>

      {loading && !doc ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 불러오는 중…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-[13px] leading-relaxed">
          참고서를 불러올 수 없습니다.
          <div className="mt-1.5 whitespace-pre-wrap opacity-80">{error}</div>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-md border border-input px-3 py-1.5 text-xs"
          >
            다시 시도
          </button>
        </div>
      ) : editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="font-mono-tin tin-scroll min-h-0 flex-1 resize-none rounded-lg border border-input bg-background p-4 text-[13px] leading-relaxed text-foreground outline-none focus:border-primary"
        />
      ) : doc ? (
        <div className="tin-scroll min-h-0 flex-1 overflow-y-auto rounded-lg border border-input bg-background px-8 py-7">
          {/* 긴 줄이 화면 끝까지 늘어나면 눈이 되돌아올 자리를 잃는다 */}
          <div className="markdown-body mx-auto max-w-4xl">
            {renderMarkdown(doc.content)}
          </div>
          <div className="mx-auto mt-8 max-w-4xl border-t border-input pt-3 text-[11px] text-muted-foreground">
            {doc.name} · 갱신 {doc.mtime}
          </div>
        </div>
      ) : null}

      {editing && (
        <div className="mt-2 shrink-0 text-[11px] text-muted-foreground">
          마크다운으로 쓴다. <code className="font-mono-tin">#</code> 제목,{" "}
          <code className="font-mono-tin">-</code> 목록,{" "}
          <code className="font-mono-tin">|</code> 표,{" "}
          <code className="font-mono-tin">```</code> 코드블록을 지원한다.
          {dirty && <span className="ml-2 text-primary">· 저장 안 된 변경 있음</span>}
        </div>
      )}
    </div>
  )
}
