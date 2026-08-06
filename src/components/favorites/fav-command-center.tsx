import { useState } from "react"
import { Loader2, PlugZap, StickyNote } from "lucide-react"

import type { Favorite } from "@/lib/favorites"
import { modeLabel, useFavorites } from "./use-favorites"

/**
 * 즐겨찾기 — GON 커맨드센터 카드 그리드.
 *
 * 카드 정보 위계는 GON .proj-card 를 그대로 따른다:
 *   상태점 + 이름 + 상태뱃지  ->  메모  ->  태그(폴더/모드)  ->  게이지
 *   ->  수치(파일 수)  ->  메타(세션/서버/포트)  ->  액션([접속])
 *
 * ★게이지는 자리만 잡아둔다★
 *   체력/마력/이동력은 아직 값을 받아올 곳이 없다. 나중에 stats 연동이 붙을
 *   자리를 미리 만들어두고 지금은 빈 막대와 "-" 로 둔다. 0% 로 채우면 "값이
 *   0" 처럼 보여서 잘못 읽힌다.
 */

/** 추후 stats 연동 시 값이 들어올 자리 */
const GAUGES: { key: string; label: string; hue: number }[] = [
  { key: "hp", label: "체력", hue: 150 },
  { key: "mp", label: "마력", hue: 190 },
  { key: "mv", label: "이동", hue: 45 },
]

function Gauges() {
  return (
    <div className="cc-gauges">
      {GAUGES.map((g) => (
        <div key={g.key} className="cc-gauge is-empty" style={{ ["--ghue" as string]: g.hue }}>
          <div className="cc-gauge-label">
            <span>{g.label}</span>
            <b>-</b>
          </div>
          <div className="cc-gauge-bar">
            <div className="cc-gauge-fill" style={{ width: 0 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function MemoLine({
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
    // 실패하면 편집 상태를 유지한다 — 사용자가 쓴 글을 날리지 않는다
    if (ok) setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(memo)
          setEditing(true)
        }}
        title="메모 편집"
        className="cc-desc"
        style={{ display: "flex", gap: 6, width: "100%", textAlign: "left" }}
      >
        <StickyNote
          className="size-3 shrink-0"
          style={{ marginTop: 3, color: memo ? "var(--cyan-dim)" : "var(--text-dim)" }}
        />
        <span style={{ minWidth: 0, flex: 1, opacity: memo ? 1 : 0.65 }}>
          {memo || "메모 추가"}
        </span>
      </button>
    )
  }

  return (
    <div style={{ margin: "2px 0 8px" }}>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
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
          borderRadius: 2,
          border: "1px solid rgba(63, 230, 255, 0.28)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--text)",
          fontSize: 11.5,
          lineHeight: 1.5,
          outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: 9.5, letterSpacing: 1, color: "var(--text-dim)", marginRight: "auto" }}>
          CTRL+ENTER 저장 · ESC 취소
        </span>
        <button onClick={() => setEditing(false)} disabled={saving} className="cc-btn">
          취소
        </button>
        <button onClick={() => void commit()} disabled={saving} className="cc-btn">
          {saving && <Loader2 className="size-3 animate-spin" />}
          저장
        </button>
      </div>
    </div>
  )
}

export function FavCommandCenter({ reloadKey }: { reloadKey: number }) {
  const { groups, loading, busy, connect, saveMemo, lastConnect } = useFavorites(reloadKey)

  if (loading) {
    return (
      <div className="cc-panel" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Loader2 className="size-4 animate-spin" style={{ color: "var(--cyan)" }} />
        <span className="cc-panel-title">LOADING…</span>
      </div>
    )
  }

  return (
    <div className="ui-sections">
      {groups.map((g) => (
        <section key={g.folder}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
              paddingBottom: 6,
              borderBottom: "1px solid var(--panel-border)",
            }}
          >
            <span className="cc-panel-title">{g.label}</span>
            <span style={{ fontSize: 10, letterSpacing: 1.5, color: "var(--text-dim)" }}>
              {g.items.length} UNITS
            </span>
          </div>

          <div className="cc-grid">
            {g.items.map((f) => {
              const connected = Boolean(lastConnect[f.id])
              return (
                <article key={f.id} className="cc-card">
                  {/* 머리 — 상태점 + 이름 + 뱃지 */}
                  <div className="cc-head">
                    <span className={`cc-dot ${connected ? "on" : "off"}`} />
                    <span className="cc-name">{f.name}</span>
                    <span className={`cc-badge ${connected ? "ok" : "off"}`}>
                      {connected ? "ONLINE" : "IDLE"}
                    </span>
                  </div>

                  <MemoLine fav={f} onSave={saveMemo} />

                  {/* 태그 — 폴더 / 접속 모드 */}
                  <div className="cc-tags">
                    <span className={`cc-stage ${f.mode === "group" ? "run" : "wait"}`}>
                      {modeLabel(f)}
                    </span>
                    <span className="cc-tag">{g.label}</span>
                  </div>

                  {/* 게이지 — 값은 추후 stats 연동 */}
                  <Gauges />

                  {/* 수치 */}
                  <div className="cc-stats">
                    <span>
                      FILES <b>{f.files.length}</b>
                    </span>
                    <span>
                      COMBO <b>{f.combo}</b>
                    </span>
                  </div>

                  {/* 메타 — 세션 / 서버 / 포트 */}
                  <div className="cc-meta">
                    <div className="cc-meta-item">
                      <span className="cc-meta-k">SESSION</span>
                      <span className="cc-meta-v">{f.session || "-"}</span>
                    </div>
                    <div className="cc-meta-item">
                      <span className="cc-meta-k">HOST</span>
                      <span className="cc-meta-v">
                        {f.host || "-"}
                        {f.port ? `:${f.port}` : ""}
                      </span>
                    </div>

                    <button
                      onClick={() => void connect(f)}
                      disabled={busy !== null}
                      className="cc-btn"
                      style={{ marginTop: 4 }}
                      title={`${modeLabel(f)} 접속 — ${f.combo}.tin`}
                    >
                      {busy === f.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <PlugZap className="size-3.5" />
                      )}
                      CONNECT
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
