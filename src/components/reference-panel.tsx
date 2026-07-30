import { useCallback, useEffect, useRef, useState } from "react"
import { BookOpen, Loader2, RefreshCw, X } from "lucide-react"

import { getDoc, type DocContent } from "@/lib/api"
import { renderMarkdown } from "@/lib/markdown"

const WIDTH_KEY = "tinadmin.refPanelWidth"
const MIN_W = 260
const MAX_W = 760
const DEFAULT_W = 380

/** 문서 이름 — 서버 docs/참고서.md */
const DOC_KEY = "참고서"

export function loadPanelWidth(): number {
  const v = Number(localStorage.getItem(WIDTH_KEY))
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_W
  return Math.min(MAX_W, Math.max(MIN_W, v))
}

/**
 * 우측 고정 참고 패널. 기존 Cheatsheet 와 같은 자리/구조를 쓴다.
 *
 * - 문서는 서버(/api/docs/참고서)에서 받아온다 → 문서를 고쳐도 앱 재빌드 불필요
 * - 좌측 경계를 드래그해 너비 조절, 값은 localStorage 에 저장되어 다음 실행에도 유지
 * - 불러오기 실패해도 앱 나머지는 정상 동작해야 하므로 패널 안에서만 오류를 표시한다
 */
export function ReferencePanel({ onClose }: { onClose: () => void }) {
  const [doc, setDoc] = useState<DocContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState(() => loadPanelWidth())
  const dragging = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDoc(await getDoc(DOC_KEY))
    } catch (e) {
      // 참고서 실패가 앱 전체로 전파되지 않게 여기서 삼킨다
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 너비 드래그
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      const next = Math.min(
        MAX_W,
        Math.max(MIN_W, window.innerWidth - e.clientX),
      )
      setWidth(next)
    }
    function onUp() {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      localStorage.setItem(WIDTH_KEY, String(width))
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [width])

  return (
    <aside
      className="relative flex shrink-0 flex-col border-l"
      style={{
        width,
        borderColor: "var(--tin-edge)",
        background: "var(--tin-panel)",
      }}
    >
      {/* 드래그 손잡이 */}
      <div
        onMouseDown={() => {
          dragging.current = true
          document.body.style.cursor = "col-resize"
          document.body.style.userSelect = "none"
        }}
        title="드래그하여 너비 조절"
        className="absolute top-0 left-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-[var(--tin-accent)]"
        style={{ opacity: 0.6 }}
      />

      {/* 헤더 */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5 pl-5"
        style={{ borderColor: "var(--tin-edge)" }}
      >
        <BookOpen className="tin-accent size-4 shrink-0" />
        <span
          className="tin-accent font-semibold tracking-wide"
          style={{ fontSize: "var(--tin-fs-sm)" }}
        >
          운영 참고서
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => void load()}
            title="새로 불러오기"
            className="flex size-6 items-center justify-center rounded hover:bg-[var(--tin-panel2)]"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            title="패널 닫기"
            className="flex size-6 items-center justify-center rounded hover:bg-[var(--tin-panel2)]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="tin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3 pl-5">
        {loading && !doc ? (
          <div
            className="flex items-center gap-2 py-8"
            style={{ fontSize: "var(--tin-fs-sm)" }}
          >
            <Loader2 className="size-4 animate-spin" /> 불러오는 중…
          </div>
        ) : error ? (
          <div>
            <div
              className="mb-3 rounded-md border p-3 leading-relaxed"
              style={{
                borderColor: "rgb(255 95 86 / 0.4)",
                background: "rgb(255 95 86 / 0.1)",
                color: "var(--tin-fg)",
                fontSize: "var(--tin-fs-sm)",
              }}
            >
              참고서를 불러올 수 없습니다.
              <div className="mt-1.5 whitespace-pre-wrap" style={{ opacity: 0.8 }}>
                {error}
              </div>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-md border px-3 py-1.5"
              style={{
                borderColor: "var(--tin-edge)",
                fontSize: "var(--tin-fs-sm)",
              }}
            >
              다시 시도
            </button>
          </div>
        ) : doc ? (
          <>
            <div className="markdown-body">{renderMarkdown(doc.content)}</div>
            <div
              className="mt-6 border-t pt-2"
              style={{
                borderColor: "var(--tin-edge)",
                fontSize: "var(--tin-fs-sm)",
                opacity: 0.7,
              }}
            >
              {doc.name} · 갱신 {doc.mtime}
            </div>
          </>
        ) : null}
      </div>
    </aside>
  )
}
