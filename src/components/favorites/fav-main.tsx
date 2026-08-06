import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  PlugZap,
  StickyNote,
} from "lucide-react"

import type { Favorite } from "@/lib/favorites"
import { modeLabel, useFavorites } from "./use-favorites"

/**
 * 즐겨찾기 — 확정 화면.
 *
 * 폴더별 섹션(접이식) + 중간 크기 카드 그리드. 카드가 너무 크면 20개를 보려고
 * 계속 스크롤해야 하고, 너무 작으면 메모가 들어갈 자리가 없다. 260px 그리드가
 * 그 사이다.
 *
 * 메모는 접속과 무관한 표시용 데이터다. 서버 favorites.json 에 함께 저장되어
 * PC 를 바꿔도 따라온다.
 */

function MemoBox({
  fav,
  onSave,
}: {
  fav: Favorite
  onSave: (id: string, memo: string) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(fav.memo ?? "")
  const [saving, setSaving] = useState(false)

  const memo = fav.memo ?? ""

  async function commit() {
    setSaving(true)
    const ok = await onSave(fav.id, draft.trim())
    setSaving(false)
    if (ok) setEditing(false)
    // 실패하면 편집 상태를 유지한다 — 사용자가 쓴 글을 날리지 않는다
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(memo)
          setEditing(true)
        }}
        title="메모 편집"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          width: "100%",
          marginTop: "var(--gap)",
          paddingTop: "var(--gap)",
          borderTop: "1px solid var(--border-soft)",
          textAlign: "left",
        }}
      >
        {memo ? (
          <StickyNote
            className="size-3.5 shrink-0"
            style={{ marginTop: 2, color: "var(--accent)" }}
          />
        ) : (
          <Pencil className="size-3.5 shrink-0" style={{ marginTop: 2, opacity: 0.6 }} />
        )}
        <span
          className="ty-sub"
          style={{
            minWidth: 0,
            flex: 1,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            opacity: memo ? 1 : 0.6,
          }}
        >
          {memo || "메모 추가"}
        </span>
      </button>
    )
  }

  return (
    <div
      style={{
        marginTop: "var(--gap)",
        paddingTop: "var(--gap)",
        borderTop: "1px solid var(--border-soft)",
      }}
    >
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter 저장, Esc 취소 — 여러 줄을 쓸 수 있게 Enter 는 줄바꿈
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void commit()
          if (e.key === "Escape") setEditing(false)
        }}
        rows={3}
        placeholder="예) 트로이 사냥 전용 · 수리 별칭 없음"
        spellCheck={false}
        style={{
          width: "100%",
          resize: "vertical",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
          fontSize: "var(--fs-sub)",
          lineHeight: "var(--lh)",
          outline: "none",
        }}
      />
      <div className="ui-row" style={{ gap: 6, marginTop: 8 }}>
        <span className="ty-sub" style={{ marginRight: "auto" }}>
          Ctrl+Enter 저장 · Esc 취소
        </span>
        <button onClick={() => setEditing(false)} disabled={saving} className="ui-btn">
          취소
        </button>
        <button onClick={() => void commit()} disabled={saving} className="ui-btn ui-btn-accent">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          저장
        </button>
      </div>
    </div>
  )
}

export function FavMain({ reloadKey }: { reloadKey: number }) {
  const { groups, loading, busy, connect, saveMemo } = useFavorites(reloadKey)
  const [closed, setClosed] = useState<Set<string>>(new Set())

  function toggle(folder: string) {
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  if (loading) {
    return (
      <div className="ui-card ui-row">
        <Loader2 className="size-4 animate-spin" />
        <span className="ty-body">불러오는 중…</span>
      </div>
    )
  }

  return (
    <div className="ui-sections">
      {groups.map((g) => {
        const open = !closed.has(g.folder)
        return (
          <section key={g.folder}>
            {/* 폴더 = 섹션 헤더 (접이식) */}
            <button
              onClick={() => toggle(g.folder)}
              className="ui-row"
              style={{ width: "100%", marginBottom: open ? "var(--gap)" : 0 }}
            >
              {open ? (
                <ChevronDown className="size-4" style={{ color: "var(--accent)" }} />
              ) : (
                <ChevronRight className="size-4" style={{ color: "var(--accent)" }} />
              )}
              <span className="ty-sec">{g.label}</span>
              <span className="ty-sub">{g.items.length}개</span>
            </button>

            {open && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: "var(--gap)",
                }}
              >
                {g.items.map((f) => (
                  <div
                    key={f.id}
                    className="ui-card"
                    style={{ display: "flex", flexDirection: "column", padding: 16 }}
                  >
                    <div className="ty-sec" style={{ marginBottom: 6 }}>
                      {f.name}
                    </div>

                    <div className="ui-row" style={{ gap: 6, marginBottom: "var(--gap)" }}>
                      <span
                        className="ty-sub"
                        style={{
                          padding: "1px 8px",
                          borderRadius: 999,
                          background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                          color: "var(--accent)",
                        }}
                      >
                        {g.label}
                      </span>
                      <span className="ty-sub">{modeLabel(f)}</span>
                      <span className="ty-sub tabular-nums">파일 {f.files.length}</span>
                    </div>

                    <button
                      onClick={() => void connect(f)}
                      disabled={busy !== null}
                      className="ui-btn ui-btn-accent"
                      style={{ justifyContent: "center" }}
                      title={`${modeLabel(f)} 접속 — ${f.combo}.tin`}
                    >
                      {busy === f.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PlugZap className="size-4" />
                      )}
                      접속
                    </button>

                    <MemoBox fav={f} onSave={saveMemo} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
