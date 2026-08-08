import { useEffect, useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"

import { getItems, type ItemRow } from "@/lib/items"

/**
 * 아이템 도감 — /api/items 가 주는 그대로(부위 + raw_line) 보여준다.
 *
 * ★컬럼을 억지로 안 나눈다★
 *   서버 쪽 items.json 자체가 "컬럼을 쪼개지 말고 원문 보존"으로 만들어졌다
 *   (items_data/raw_full.txt 참고). 부위마다 컬럼 구성이 달라서(무기=타격치/
 *   평타/마법, 신발=썩 등) 여기서도 raw_line 을 탭(\t) 기준으로만 나눠 셀로
 *   늘어놓는다. 컬럼 이름은 붙이지 않는다 — 행마다 셀 개수가 다르다.
 */

/** raw_line 끝쪽에서 "순수 정수" 셀(랩/레벨)을 찾는다 — 범위값(12-14)·소수(17.5)는 건너뛴다. */
function levelKey(raw: string): number {
  const cells = raw.split("\t")
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i].trim()
    if (/^\d+$/.test(c)) return Number(c)
  }
  // 못 찾으면 정렬에서 뒤로 밀되(레벨 있는 항목들이 앞으로), 이런 항목끼리는
  // 원래(items.json) 순서를 그대로 유지한다 — Array.sort 는 안정 정렬이라
  // 동일 키(Infinity)끼리는 입력 순서가 보존된다.
  return Number.POSITIVE_INFINITY
}

export function ItemsView() {
  const [items, setItems] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [part, setPart] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let alive = true
    void getItems().then((d) => {
      if (alive) {
        setItems(d)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  // 탭 목록 — items.json 에 실제로 있는 부위만, 처음 등장한 순서 그대로(=raw_full.txt 의 부위 순서)
  const parts = useMemo(() => {
    const seen: string[] = []
    for (const it of items) {
      if (!seen.includes(it.부위)) seen.push(it.부위)
    }
    return seen
  }, [items])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of items) m.set(it.부위, (m.get(it.부위) ?? 0) + 1)
    return m
  }, [items])

  const filtered = useMemo(() => {
    let rows = items
    if (part) rows = rows.filter((it) => it.부위 === part)
    const q = query.trim()
    if (q) rows = rows.filter((it) => it.raw_line.includes(q))
    // 안정 정렬 — 레벨 같은 항목끼리는 원래 순서 유지
    return [...rows].sort((a, b) => levelKey(a.raw_line) - levelKey(b.raw_line))
  }, [items, part, query])

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto" style={{ padding: "var(--gap-sec)" }}>
      <div className="ui-sections">
        <div className="cc-panel">
          <div className="ui-row" style={{ flexWrap: "wrap", gap: "var(--gap)" }}>
            <span className="ty-h" style={{ fontFamily: "var(--font-display)" }}>
              아이템 도감
            </span>
            <span className="ty-sub">부위 탭으로 좁히고, 이름으로 검색하세요 (레벨 오름차순)</span>
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
            <button onClick={() => setPart(null)} className={`cc-tab${part === null ? " is-on" : ""}`}>
              전체 <span className="cc-tab-n">{items.length}</span>
            </button>
            {parts.map((p) => (
              <button
                key={p}
                onClick={() => setPart(p)}
                className={`cc-tab${part === p ? " is-on" : ""}`}
              >
                {p} <span className="cc-tab-n">{counts.get(p) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="cc-panel" style={{ padding: 0, overflowX: "auto" }}>
          {!loading && filtered.length === 0 && (
            <div className="ty-sub" style={{ padding: "var(--gap-sec)" }}>
              해당하는 아이템이 없습니다.
            </div>
          )}
          {filtered.length > 0 && (
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
              <tbody>
                {filtered.map((it, idx) => (
                  <tr
                    key={`${it.부위}-${idx}-${it.raw_line}`}
                    style={{ borderBottom: "1px solid var(--border-soft)" }}
                  >
                    {it.raw_line.split("\t").map((cell, i) => (
                      <td
                        key={i}
                        style={{
                          padding: "6px 10px",
                          whiteSpace: "nowrap",
                          fontFamily: i === 0 ? "inherit" : "var(--font-mono)",
                          color: i === 0 ? "var(--text)" : "rgba(210, 228, 240, 0.85)",
                        }}
                      >
                        {cell || " "}
                      </td>
                    ))}
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
