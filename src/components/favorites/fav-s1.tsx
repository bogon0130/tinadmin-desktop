import { useEffect, useState } from "react"
import { Folder, Loader2, PlugZap } from "lucide-react"

import { modeLabel, useFavorites } from "./use-favorites"

/**
 * S1 — 컴팩트 목록 (탐색기 느낌).
 *
 * 왼쪽 폴더 트리에서 하나를 고르면 오른쪽에 그 폴더 항목만 세로로 나온다.
 * 한 줄에 이름·모드·접속 버튼을 모아 정보밀도를 높였다 — 20개를 스크롤 없이
 * 훑고 바로 누르는 게 목적이다.
 */
export function FavS1({ reloadKey }: { reloadKey: number }) {
  const { groups, loading, busy, connect } = useFavorites(reloadKey)
  const [sel, setSel] = useState<string | null>(null)

  // 첫 로드 후 첫 폴더를 자동 선택 (빈 화면을 보여주지 않는다)
  useEffect(() => {
    if (sel === null && groups.length > 0) setSel(groups[0].folder)
  }, [groups, sel])

  const cur = groups.find((g) => g.folder === sel) ?? groups[0]

  if (loading) {
    return (
      <div className="ui-card ui-row">
        <Loader2 className="size-4 animate-spin" />
        <span className="ty-body">불러오는 중…</span>
      </div>
    )
  }

  return (
    <div className="flex gap-[var(--gap-lg)]" style={{ alignItems: "flex-start" }}>
      {/* 왼쪽 — 폴더 트리 */}
      <nav className="ui-card shrink-0" style={{ width: 190, padding: 10 }}>
        <div className="ty-sub" style={{ padding: "4px 8px 8px" }}>
          폴더
        </div>
        <div className="ui-stack" style={{ gap: 2 }}>
          {groups.map((g) => {
            const on = cur?.folder === g.folder
            return (
              <button
                key={g.folder}
                onClick={() => setSel(g.folder)}
                className="ui-row"
                style={{
                  width: "100%",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: on ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                  color: on ? "var(--accent)" : "var(--text)",
                  fontWeight: on ? "var(--fw-med)" : "var(--fw-body)",
                  fontSize: "var(--fs-body)",
                }}
              >
                <Folder className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">{g.label}</span>
                <span className="ty-sub shrink-0">{g.items.length}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* 오른쪽 — 선택 폴더의 항목 목록 */}
      <div className="ui-card min-w-0 flex-1">
        <div className="ui-row" style={{ marginBottom: "var(--gap)" }}>
          <span className="ty-sec">{cur?.label ?? "-"}</span>
          <span className="ty-sub">{cur?.items.length ?? 0}개</span>
        </div>

        <div className="ui-stack" style={{ gap: 6 }}>
          {(cur?.items ?? []).map((f) => (
            <div
              key={f.id}
              className="ui-row"
              style={{
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              <span className="ty-med min-w-0 flex-1 truncate">{f.name}</span>
              <span className="ty-sub shrink-0">{modeLabel(f)}</span>
              <span className="ty-sub shrink-0 tabular-nums">{f.files.length}개 파일</span>
              <button
                onClick={() => void connect(f)}
                disabled={busy !== null}
                className="ui-btn shrink-0"
                title={`${modeLabel(f)} 접속 — ${f.combo}.tin`}
              >
                {busy === f.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <PlugZap className="size-3.5" />
                )}
                접속
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
