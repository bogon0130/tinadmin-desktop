import { useCallback, useEffect, useState } from "react"
import { Loader2, Pencil, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"

import { getDoc, saveDoc, type DocContent } from "@/lib/api"
import { renderMarkdown } from "@/lib/markdown"

/**
 * 그룹별 운영 참고서 화면 (한비광그룹 / 천마신군그룹).
 *
 * 내용은 앱에 하드코딩하지 않고 서버 docs/<이름>.md 에서 받아온다 — 우측
 * '운영 참고서' 패널(reference-panel.tsx)과 같은 방식이다. 문서를 고칠 때
 * 앱을 다시 빌드하지 않아도 되게 하려는 것이고, 여기서는 한 발 더 나아가
 * 앱 안에서 바로 고쳐 저장한다(POST /api/docs/<이름>).
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
        <div className="tin-scroll min-h-0 flex-1 overflow-y-auto rounded-lg border border-input bg-background px-5 py-4">
          <div className="markdown-body">{renderMarkdown(doc.content)}</div>
          <div className="mt-6 border-t border-input pt-2 text-[11px] text-muted-foreground">
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
