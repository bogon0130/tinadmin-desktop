import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUpDown, Loader2, Search } from "lucide-react"

import { getItems, type ItemsData } from "@/lib/items"

/**
 * 아이템 도감 — 엑셀(items_data/item.xlsx) 시트를 그대로 옮긴 구조를 보여준다.
 *
 * ★부위마다 컬럼이 다르다★
 *   서버가 주는 columns[부위]가 그 부위의 실제 헤더 순서다("무기"=타격치/
 *   평타/마법, "몸"=방어/충흡/특수 등). 컬럼 이름을 새로 짓거나 순서를
 *   바꾸지 않고 그대로 <th>로 늘어놓는다.
 *
 * "전체" 탭은 없다(작업서 지시) — 항상 부위 하나를 골라야 하고, 처음 진입
 * 시 parts[0]이 자동 선택된다.
 */

/** "레벨" 정렬용 키 — 숫자면 그대로, "7~9" 같은 범위값은 앞 숫자, 빈칸은 맨 뒤로. */
function levelSortKey(v: unknown): number {
  if (v === "" || v === null || v === undefined) return Number.POSITIVE_INFINITY
  if (typeof v === "number") return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY
  const m = String(v).match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

type SortMode = "original" | "level-asc"

export function ItemsView() {
  const [data, setData] = useState<ItemsData>({ parts: [], columns: {}, rows: [] })
  const [loading, setLoading] = useState(true)
  const [part, setPart] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("original")

  useEffect(() => {
    let alive = true
    void getItems().then((d) => {
      if (alive) {
        setData(d)
        setLoading(false)
        // 최초 진입 시 첫 부위 탭을 기본 선택 — 빈 화면으로 두지 않는다
        setPart((prev) => prev ?? d.parts[0] ?? null)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  // 부위가 바뀌면 정렬 상태를 원래 순서로 되돌린다(부위마다 독립된 토글이어야 헷갈리지 않는다)
  function selectPart(p: string) {
    setPart(p)
    setSortMode("original")
  }

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of data.rows) {
      const key = String(r.부위)
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return m
  }, [data.rows])

  const columns = part ? data.columns[part] ?? [] : []

  const filteredSorted = useMemo(() => {
    if (!part) return []
    let rows = data.rows.filter((r) => r.부위 === part)
    const q = query.trim()
    if (q) rows = rows.filter((r) => cellText(r["이름"]).includes(q))
    if (sortMode === "level-asc") {
      // 안정 정렬 — 레벨 같은 항목끼리는 원래(엑셀) 순서 유지
      rows = [...rows].sort((a, b) => levelSortKey(a["레벨"]) - levelSortKey(b["레벨"]))
    }
    return rows
  }, [data.rows, part, query, sortMode])

  function toggleLevelSort() {
    setSortMode((m) => (m === "level-asc" ? "original" : "level-asc"))
  }

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto" style={{ padding: "var(--gap-sec)" }}>
      <div className="ui-sections">
        <div className="cc-panel">
          <div className="ui-row" style={{ flexWrap: "wrap", gap: "var(--gap)" }}>
            <span className="ty-h" style={{ fontFamily: "var(--font-display)" }}>
              아이템 도감
            </span>
            <span className="ty-sub">부위 탭을 고르고, 이름으로 검색하세요 (레벨 헤더 클릭 시 정렬)</span>
            {loading && <Loader2 className="size-4 animate-spin" style={{ color: "var(--cyan)" }} />}

            <div style={{ marginLeft: "auto", position: "relative" }}>
              <Search
                className="size-3.5"
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-dim)",
                  pointerEvents: "none",
                }}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 검색…"
                spellCheck={false}
                style={{
                  width: 220,
                  padding: "7px 10px 7px 30px",
                  borderRadius: 2,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontSize: 12.5,
                }}
              />
            </div>
          </div>

          <div className="cc-tabs" style={{ marginTop: 12 }}>
            {data.parts.map((p) => (
              <button
                key={p}
                onClick={() => selectPart(p)}
                className={`cc-tab${part === p ? " is-on" : ""}`}
              >
                {p} <span className="cc-tab-n">{counts.get(p) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="cc-panel" style={{ padding: 0, overflowX: "auto" }}>
          {!loading && filteredSorted.length === 0 && (
            <div className="ty-sub" style={{ padding: "var(--gap-sec)" }}>
              해당하는 아이템이 없습니다.
            </div>
          )}
          {part && filteredSorted.length > 0 && (
            <table style={{ borderCollapse: "collapse", width: "auto", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {columns.map((col, i) => {
                    const lastCol = i === columns.length - 1
                    return col === "레벨" ? (
                      <th
                        key={col}
                        onClick={toggleLevelSort}
                        title="클릭: 레벨 오름차순 / 다시 클릭: 원래 순서"
                        style={{
                          padding: "8px 7px",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                          fontFamily: "var(--font-mono)",
                          color: sortMode === "level-asc" ? "var(--cyan)" : "var(--text-dim)",
                          cursor: "pointer",
                          userSelect: "none",
                          borderRight: lastCol ? undefined : "1px solid var(--border-soft)",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {col}
                          {sortMode === "level-asc" ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3" />
                          )}
                        </span>
                      </th>
                    ) : (
                      <th
                        key={col}
                        style={{
                          padding: "8px 7px",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-dim)",
                          borderRight: lastCol ? undefined : "1px solid var(--border-soft)",
                        }}
                      >
                        {col}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredSorted.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    {columns.map((col, i) => {
                      const lastCol = i === columns.length - 1
                      return (
                        <td
                          key={col}
                          style={{
                            padding: "6px 7px",
                            textAlign: col === "이름" ? "left" : undefined,
                            whiteSpace: "nowrap",
                            fontFamily: i === 0 ? "var(--font-mono)" : "inherit",
                            color: col === "이름" ? "var(--text)" : "rgba(210, 228, 240, 0.85)",
                            borderRight: lastCol ? undefined : "1px solid var(--border-soft)",
                          }}
                        >
                          {cellText(row[col]) || " "}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
