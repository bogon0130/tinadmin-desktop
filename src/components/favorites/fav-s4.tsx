import { Loader2, PlugZap } from "lucide-react"

import { modeLabel, useFavorites } from "./use-favorites"

/**
 * S4 — 위젯 패널 (대시보드 위젯 느낌).
 *
 * 폴더 하나가 패널 하나다. 패널 안에서 항목은 작은 칩으로 깔린다 —
 * "지금 어느 폴더에 누가 있나"를 폴더 단위로 한눈에 보는 배치다.
 * 스크롤을 내리며 찾는 S1/S2 와 달리 4개 폴더가 동시에 보인다.
 */
export function FavS4({ reloadKey }: { reloadKey: number }) {
  const { groups, loading, busy, connect } = useFavorites(reloadKey)

  if (loading) {
    return (
      <div className="ui-card ui-row">
        <Loader2 className="size-4 animate-spin" />
        <span className="ty-body">불러오는 중…</span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "var(--gap-lg)",
      }}
    >
      {groups.map((g) => (
        <section key={g.folder} className="ui-card">
          <div className="ui-row" style={{ marginBottom: "var(--gap-lg)" }}>
            <span className="ty-sec">{g.label}</span>
            <span
              className="ty-sub tabular-nums"
              style={{
                marginLeft: "auto",
                padding: "2px 10px",
                borderRadius: 999,
                background: "color-mix(in srgb, var(--accent) 16%, transparent)",
                color: "var(--accent)",
              }}
            >
              {g.items.length}
            </span>
          </div>

          {/* 항목 = 칩. 누르면 바로 접속한다 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {g.items.map((f) => (
              <button
                key={f.id}
                onClick={() => void connect(f)}
                disabled={busy !== null}
                title={`${modeLabel(f)} 접속 — ${f.combo}.tin`}
                className="ui-row"
                style={{
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  fontSize: "var(--fs-body)",
                  fontWeight: "var(--fw-med)",
                  opacity: busy !== null && busy !== f.id ? 0.5 : 1,
                }}
              >
                {busy === f.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <PlugZap className="size-3.5" style={{ color: "var(--accent)" }} />
                )}
                {f.name}
                <span className="ty-sub">{modeLabel(f)}</span>
              </button>
            ))}
            {g.items.length === 0 && <span className="ty-sub">비어 있음</span>}
          </div>
        </section>
      ))}
    </div>
  )
}
