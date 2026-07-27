import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  X,
} from "lucide-react"

import {
  TYPE_META,
  nextTempId,
  removeEntry,
  replaceEntry,
  rowsForType,
  toggleRow,
  valuesToEntry,
} from "@/lib/tin-utils"
import type { Row, TableType, TinEntry } from "@/lib/types"

interface Props {
  type: TableType
  entries: TinEntry[]
  onChange: (next: TinEntry[]) => void
}

export function EntryTable({ type, entries, onChange }: Props) {
  const meta = TYPE_META[type]
  const [query, setQuery] = useState("")
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<string[]>([])

  const rows = useMemo(() => rowsForType(entries, type), [entries, type])

  const visible = useMemo(() => {
    let list = rows
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((r) =>
        r.values.some((v) => (v ?? "").toLowerCase().includes(q)),
      )
    }
    if (sortCol !== null) {
      list = [...list].sort((a, b) => {
        const av = (a.values[sortCol] ?? "").toLowerCase()
        const bv = (b.values[sortCol] ?? "").toLowerCase()
        if (av === bv) return 0
        return sortAsc ? (av < bv ? -1 : 1) : av < bv ? 1 : -1
      })
    }
    return list
  }, [rows, query, sortCol, sortAsc])

  function toggleSort(i: number) {
    if (sortCol === i) {
      if (sortAsc) setSortAsc(false)
      else {
        setSortCol(null)
        setSortAsc(true)
      }
    } else {
      setSortCol(i)
      setSortAsc(true)
    }
  }

  function startEdit(row: Row) {
    setEditingId(row.id)
    const d = [...row.values]
    while (d.length < meta.columns.length) d.push("")
    setDraft(d)
  }

  function commitEdit(row: Row) {
    const next = row.enabled
      ? valuesToEntry(row.id, type, draft)
      : toggleRow({ ...row, values: draft }, false)
    onChange(replaceEntry(entries, row.id, next))
    setEditingId(null)
  }

  function addRow() {
    const id = nextTempId(entries)
    const blank = Array.from({ length: meta.columns.length }, () => "")
    onChange([...entries, valuesToEntry(id, type, blank)])
    setEditingId(id)
    setDraft(blank)
  }

  function deleteRow(id: number) {
    onChange(removeEntry(entries, id))
    setSelected((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
  }

  function setRowEnabled(row: Row, enable: boolean) {
    onChange(replaceEntry(entries, row.id, toggleRow(row, enable)))
  }

  function bulkEnable(enable: boolean) {
    let next = entries
    for (const row of rows) {
      if (selected.has(row.id) && row.enabled !== enable) {
        next = replaceEntry(next, row.id, toggleRow(row, enable))
      }
    }
    onChange(next)
    setSelected(new Set())
  }

  function bulkDelete() {
    let next = entries
    for (const id of selected) next = removeEntry(next, id)
    onChange(next)
    setSelected(new Set())
  }

  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.id))

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* 상단 도구 모음 */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색…"
            spellCheck={false}
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {visible.length}/{rows.length}개
        </span>
        <button
          onClick={addRow}
          className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
        >
          <Plus className="size-3.5" />
          추가
        </button>
      </div>

      {/* 다중선택 바 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 border-b border-primary/30 bg-primary/10 px-5 py-2">
          <span className="text-xs font-medium text-primary">
            {selected.size}개 선택됨
          </span>
          <button
            onClick={() => bulkEnable(true)}
            className="rounded border border-primary/40 px-2.5 py-1 text-xs text-primary transition hover:bg-primary/20"
          >
            선택 켜기
          </button>
          <button
            onClick={() => bulkEnable(false)}
            className="rounded border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-secondary"
          >
            선택 끄기
          </button>
          <button
            onClick={bulkDelete}
            className="rounded border border-destructive/40 px-2.5 py-1 text-xs text-destructive transition hover:bg-destructive/15"
          >
            선택 삭제
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* 표 */}
      <div className="tin-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-secondary">
              <th className="w-10 border-b border-border px-3 py-2">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? new Set(visible.map((r) => r.id))
                        : new Set(),
                    )
                  }
                  className="size-3.5 accent-[oklch(0.76_0.19_150)]"
                />
              </th>
              <th className="w-12 border-b border-border px-2 py-2 text-left text-[11px] font-medium text-muted-foreground">
                사용
              </th>
              {meta.columns.map((c, i) => (
                <th
                  key={c}
                  onClick={() => toggleSort(i)}
                  className="cursor-pointer select-none border-b border-border px-3 py-2 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <span className="inline-flex items-center gap-1">
                    {c}
                    {sortCol === i &&
                      (sortAsc ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      ))}
                  </span>
                </th>
              ))}
              <th className="w-24 border-b border-border px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={meta.columns.length + 3}
                  className="px-5 py-10 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0
                    ? "항목이 없습니다. 오른쪽 위 [추가] 버튼으로 만들 수 있습니다."
                    : "검색 결과가 없습니다."}
                </td>
              </tr>
            )}

            {visible.map((row) => {
              const editing = editingId === row.id
              return (
                <tr
                  key={row.id}
                  className={`group h-10 border-b border-border/60 transition hover:bg-secondary/50 ${
                    row.enabled ? "" : "opacity-45"
                  }`}
                >
                  <td className="px-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const n = new Set(s)
                          if (e.target.checked) n.add(row.id)
                          else n.delete(row.id)
                          return n
                        })
                      }
                      className="size-3.5 accent-[oklch(0.76_0.19_150)]"
                    />
                  </td>
                  <td className="px-2">
                    <button
                      title={row.enabled ? "끄기 (주석 처리)" : "켜기"}
                      onClick={() => setRowEnabled(row, !row.enabled)}
                      className={`flex size-6 items-center justify-center rounded transition ${
                        row.enabled
                          ? "text-primary hover:bg-primary/15"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <Power className="size-3.5" />
                    </button>
                  </td>

                  {meta.columns.map((_, i) => (
                    <td key={i} className="max-w-0 px-3">
                      {editing ? (
                        <input
                          value={draft[i] ?? ""}
                          onChange={(e) => {
                            const d = [...draft]
                            d[i] = e.target.value
                            setDraft(d)
                          }}
                          spellCheck={false}
                          className="font-mono-tin w-full rounded border border-primary/60 bg-background px-2 py-1 text-[13px] text-foreground outline-none"
                        />
                      ) : (
                        <div
                          title={row.values[i] ?? ""}
                          className="font-mono-tin truncate text-[13px] text-foreground"
                        >
                          {row.values[i] ?? ""}
                        </div>
                      )}
                    </td>
                  ))}

                  <td className="px-3">
                    {editing ? (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => commitEdit(row)}
                          title="확인"
                          className="flex size-6 items-center justify-center rounded text-primary hover:bg-primary/15"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          title="취소"
                          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => startEdit(row)}
                          title="편집"
                          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => deleteRow(row.id)}
                          title="삭제"
                          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
