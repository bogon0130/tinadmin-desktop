import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Loader2, PlugZap } from "lucide-react"

import type { Favorite } from "@/lib/favorites"
import { ROOT_LABEL, modeLabel, useFavorites } from "./use-favorites"

/**
 * S3 — 대시보드 (관리자 화면 느낌).
 *
 * 위에 숫자 요약 4개, 아래에 정렬되는 표. 20개를 "훑는" 게 아니라 "관리하는"
 * 관점이다 — 어느 폴더가 몇 개인지, 오늘 뭘 추가했는지, 마지막으로 어디에
 * 접속했는지가 먼저 보인다.
 */

type SortKey = "name" | "folder" | "mode" | "files"

function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="ui-card">
      <div className="ty-sub">{label}</div>
      <div className="ty-num" style={accent ? { color: "var(--accent)" } : undefined}>
        {value}
      </div>
    </div>
  )
}

export function FavS3({ reloadKey }: { reloadKey: number }) {
  const { store, groups, loading, busy, connect, lastConnect } = useFavorites(reloadKey)
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "folder", asc: true })

  const folderOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) for (const it of g.items) m.set(it.id, g.label)
    return m
  }, [groups])

  const rows = useMemo(() => {
    const val = (f: Favorite): string | number => {
      switch (sort.key) {
        case "name":
          return f.name
        case "folder":
          return folderOf.get(f.id) ?? ROOT_LABEL
        case "mode":
          return modeLabel(f)
        case "files":
          return f.files.length
      }
    }
    return [...store.items].sort((a, b) => {
      const x = val(a)
      const y = val(b)
      const c =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "ko")
      return sort.asc ? c : -c
    })
  }, [store.items, sort, folderOf])

  /** 요약 숫자 */
  const stats = useMemo(() => {
    const t = today()
    const addedToday = store.items.filter((f) => f.createdAt === t).length
    // 마지막 접속은 서버에 없는 값이라 이 PC 기록에서 찾는다
    let recent = "-"
    let best = 0
    for (const f of store.items) {
      const ts = lastConnect[f.id]
      if (ts && ts > best) {
        best = ts
        recent = f.name
      }
    }
    return { addedToday, recent }
  }, [store.items, lastConnect])

  if (loading) {
    return (
      <div className="ui-card ui-row">
        <Loader2 className="size-4 animate-spin" />
        <span className="ty-body">불러오는 중…</span>
      </div>
    )
  }

  const th = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <th
      onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))}
      className="ty-sub"
      style={{
        textAlign: align,
        padding: "10px 12px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {sort.key === key &&
          (sort.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </span>
    </th>
  )

  return (
    <div className="ui-sections">
      {/* 요약 카드 4개 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "var(--gap)",
        }}
      >
        <Stat label="전체 즐겨찾기" value={String(store.items.length)} accent />
        <Stat label="폴더" value={String(groups.length)} />
        <Stat label="오늘 추가" value={String(stats.addedToday)} />
        <Stat label="최근 접속" value={stats.recent} />
      </div>

      {/* 표 */}
      <div className="ui-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="tin-scroll" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {th("name", "이름")}
                {th("folder", "폴더")}
                {th("mode", "모드")}
                {th("files", "파일", "right")}
                <th
                  className="ty-sub"
                  style={{
                    textAlign: "right",
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  접속
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td className="ty-med" style={{ padding: "10px 12px" }}>
                    {f.name}
                  </td>
                  <td className="ty-body" style={{ padding: "10px 12px" }}>
                    {folderOf.get(f.id) ?? ROOT_LABEL}
                  </td>
                  <td className="ty-body" style={{ padding: "10px 12px" }}>
                    {modeLabel(f)}
                  </td>
                  <td
                    className="ty-body tabular-nums"
                    style={{ padding: "10px 12px", textAlign: "right" }}
                  >
                    {f.files.length}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>
                    <button
                      onClick={() => void connect(f)}
                      disabled={busy !== null}
                      className="ui-btn"
                      title={`${modeLabel(f)} 접속 — ${f.combo}.tin`}
                    >
                      {busy === f.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <PlugZap className="size-3.5" />
                      )}
                      접속
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
