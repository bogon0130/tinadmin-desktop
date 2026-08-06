import { Loader2, PlugZap } from "lucide-react"

import { modeLabel, useFavorites } from "./use-favorites"

/**
 * S2 — 큰 카드 그리드 (갤러리 느낌).
 *
 * 항목 하나가 카드 하나다. 이름을 크게 띄우고 폴더/모드/파일 수를 보조로 깔고
 * 카드 폭 전체를 쓰는 [접속] 버튼을 둔다. 한 화면에 적게 보이는 대신 오조작이
 * 적고, 어떤 캐릭터인지 훑기 쉽다.
 */
export function FavS2({ reloadKey }: { reloadKey: number }) {
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
    <div className="ui-sections">
      {groups.map((g) => (
        <section key={g.folder}>
          {/* 폴더는 섹션 헤더로만 구분한다 (카드가 주인공) */}
          <div className="ui-row" style={{ marginBottom: "var(--gap)" }}>
            <span className="ty-sec">{g.label}</span>
            <span className="ty-sub">{g.items.length}개</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "var(--gap-lg)",
            }}
          >
            {g.items.map((f) => (
              <div key={f.id} className="ui-card" style={{ display: "flex", flexDirection: "column" }}>
                <div className="ty-h" style={{ fontSize: 20, marginBottom: 6 }}>
                  {f.name}
                </div>

                <div className="ui-row" style={{ gap: 6, marginBottom: "var(--gap-lg)" }}>
                  <span
                    className="ty-sub"
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "color-mix(in srgb, var(--accent) 14%, transparent)",
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
                  style={{ marginTop: "auto", justifyContent: "center", padding: "10px 12px" }}
                  title={`${modeLabel(f)} 접속 — ${f.combo}.tin`}
                >
                  {busy === f.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <PlugZap className="size-4" />
                  )}
                  접속
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
