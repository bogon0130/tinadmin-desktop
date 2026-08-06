import { useMemo, useState } from "react"
import {
  Loader2,
  Moon,
  PanelLeftDashed,
  Pencil,
  PlugZap,
  Search,
  StickyNote,
  Sun,
  Terminal,
} from "lucide-react"

import type { Favorite } from "@/lib/favorites"
import { modeLabel, useFavorites } from "./use-favorites"

/**
 * 즐겨찾기 — 좌측 목록 + 우측 상세(마스터-디테일).
 *
 * 이전 "폴더 접이식 + 카드 그리드"를 대체한다. 카드 그리드는 20개를 훑어보기엔
 * 좋았지만 캐릭터 하나를 자세히 보려면(파일 목록, 접속 정보, 긴 메모) 카드가
 * 좁아서 불편했다. 좌측은 훑어보기(목록), 우측은 한 명 자세히 보기로 나눴다.
 *
 * 데이터·접속·메모 저장은 전부 use-favorites.ts 그대로 재사용한다 — 이 파일은
 * 배치(레이아웃)만 담당한다.
 *
 * ★라이트/다크 적용 원리★
 *   .fav-root[data-theme] 안에서만 --bg/--surface/--text/--accent/--border 등
 *   토큰을 다시 정의한다(index.css). :root 전역 토큰은 건드리지 않아 다른
 *   화면(통계·파일관리·참고서)은 색이 안 바뀐다. 이 컴포넌트는 그 토큰들을
 *   var(--x) 로 직접 참조하기만 하면 되고(shadcn 의 --primary/--foreground
 *   경유 클래스는 쓰지 않는다), 라이트/다크 전환은 CSS 쪽에서 전부 해결된다.
 */

const THEME_KEY = "tinadmin.favTheme"
type FavTheme = "light" | "dark"

function readTheme(): FavTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"
  } catch {
    return "dark"
  }
}

function writeTheme(t: FavTheme) {
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* 저장 실패해도 화면 전환 자체는 된다 — 다음 실행 때만 기본값으로 */
  }
}

/** 폴더 이름 -> pill 배경/글자색 (강조 블루 1색, 잡색 없음) */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="ty-sub"
      style={{
        padding: "2px 10px",
        borderRadius: 999,
        background: "color-mix(in srgb, var(--accent) 15%, transparent)",
        color: "var(--accent)",
        fontWeight: "var(--fw-med)",
      }}
    >
      {children}
    </span>
  )
}

function ThemeToggle({ theme, onChange }: { theme: FavTheme; onChange: (t: FavTheme) => void }) {
  return (
    <button
      onClick={() => onChange(theme === "dark" ? "light" : "dark")}
      className="ui-btn"
      style={{ width: "100%", justifyContent: "center" }}
      title={theme === "dark" ? "라이트 모드로" : "다크 모드로"}
    >
      {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
      {theme === "dark" ? "야간 모드" : "주간 모드"}
    </button>
  )
}

/** 우측 상세의 큰 메모 영역 — 클릭→인라인 편집→저장. fav-main 의 MemoBox 와 같은
 *  상호작용(Ctrl+Enter 저장, Esc 취소, 저장 실패 시 글 보존)이고 크기만 키웠다. */
function DetailMemo({
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
  }

  return (
    <div className="ui-card-2" style={{ padding: 16 }}>
      <div className="ui-row" style={{ marginBottom: 10 }}>
        <StickyNote className="size-4" style={{ color: "var(--accent)" }} />
        <span className="ty-sec">메모</span>
        <span className="ty-sub" style={{ marginLeft: "auto" }}>
          모든 PC에 공유됩니다
        </span>
      </div>

      {editing ? (
        <>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void commit()
              if (e.key === "Escape") setEditing(false)
            }}
            rows={8}
            placeholder="예) 트로이 사냥 전용 · 수리 별칭 없음"
            spellCheck={false}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: "var(--lh)",
              outline: "none",
            }}
          />
          <div className="ui-row" style={{ gap: 6, marginTop: 10 }}>
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
        </>
      ) : (
        <button
          onClick={() => {
            setDraft(memo)
            setEditing(true)
          }}
          title="클릭해서 편집"
          style={{
            display: "block",
            width: "100%",
            minHeight: 120,
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px dashed var(--border)",
          }}
        >
          {memo ? (
            <span
              className="ty-body"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {memo}
            </span>
          ) : (
            <span className="ui-row" style={{ opacity: 0.6 }}>
              <Pencil className="size-3.5" />
              <span className="ty-sub">메모 추가</span>
            </span>
          )}
        </button>
      )}
    </div>
  )
}

/** 우측 상세 — 캐릭터 1명의 아이디 카드 */
function DetailCard({
  fav,
  busy,
  onConnect,
  onSaveMemo,
  folderLabel,
}: {
  fav: Favorite
  busy: string | null
  onConnect: (f: Favorite) => void
  onSaveMemo: (id: string, memo: string) => Promise<boolean>
  folderLabel: string
}) {
  return (
    <div className="ui-sections" style={{ maxWidth: 640 }}>
      <div>
        <div className="ty-h" style={{ marginBottom: 10 }}>
          {fav.name}
        </div>
        <div className="ui-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Pill>{folderLabel}</Pill>
          <span className="ty-sub">{modeLabel(fav)} 접속</span>
          <span className="ty-sub tin-mono">
            {fav.host || "?"}:{fav.port || "?"}
          </span>
        </div>
      </div>

      <button
        onClick={() => onConnect(fav)}
        disabled={busy !== null}
        className="ui-btn ui-btn-accent"
        style={{
          justifyContent: "center",
          padding: "14px 20px",
          fontSize: "var(--fs-sec)",
          fontWeight: "var(--fw-sec)",
          borderRadius: "var(--radius-card)",
        }}
        title={`${modeLabel(fav)} 접속 — ${fav.combo}.tin`}
      >
        {busy === fav.id ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <PlugZap className="size-5" />
        )}
        접속
      </button>

      <div className="ui-card-2" style={{ padding: 16 }}>
        <div className="ui-row" style={{ marginBottom: 10 }}>
          <Terminal className="size-4" style={{ color: "var(--accent)" }} />
          <span className="ty-sec">읽어들이는 파일</span>
          <span className="ty-sub tabular-nums" style={{ marginLeft: "auto" }}>
            {fav.files.length}개
          </span>
        </div>
        <ol className="ui-stack" style={{ gap: 6 }}>
          {fav.files.map((f, i) => (
            <li key={f + i} className="ui-row" style={{ gap: 8 }}>
              <span className="ty-sub tabular-nums" style={{ width: 18, textAlign: "right" }}>
                {i + 1}
              </span>
              <span className="tin-mono ty-body" style={{ wordBreak: "break-all" }}>
                {f}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <DetailMemo fav={fav} onSave={onSaveMemo} />
    </div>
  )
}

/** 좌측이 비어 있거나(검색 결과 없음) 아직 아무것도 고르지 않았을 때 */
function EmptyDetail({ text }: { text: string }) {
  return (
    <div
      className="ui-row"
      style={{ height: "100%", justifyContent: "center", opacity: 0.6 }}
    >
      <PanelLeftDashed className="size-5" />
      <span className="ty-body">{text}</span>
    </div>
  )
}

export function FavMasterDetail({ reloadKey }: { reloadKey: number }) {
  const { groups, loading, busy, connect, saveMemo } = useFavorites(reloadKey)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [theme, setTheme] = useState<FavTheme>(() => readTheme())

  function changeTheme(t: FavTheme) {
    setTheme(t)
    writeTheme(t)
  }

  const totalCount = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => ({ ...g, items: g.items.filter((f) => f.name.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0)
  }, [groups, query])

  const selected = useMemo(() => {
    const flat = groups.flatMap((g) => g.items.map((fav) => ({ fav, folderLabel: g.label })))
    return flat.find((x) => x.fav.id === selectedId) ?? null
  }, [groups, selectedId])

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
      className="fav-root"
      data-theme={theme}
      style={{
        display: "flex",
        minHeight: 0,
        flex: 1,
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--border)",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* 좌측 — 목록 */}
      <div
        className="tin-scroll"
        style={{
          width: 280,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          borderRight: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ position: "relative" }}>
            <Search
              className="size-4"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.5,
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름으로 찾기"
              spellCheck={false}
              style={{
                width: "100%",
                padding: "8px 10px 8px 34px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: "var(--fs-body)",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div className="tin-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 10 }}>
          {filteredGroups.length === 0 ? (
            <div className="ty-sub" style={{ padding: 12, textAlign: "center" }}>
              {totalCount === 0 ? "즐겨찾기가 없습니다." : "검색 결과가 없습니다."}
            </div>
          ) : (
            <div className="ui-sections" style={{ gap: 16 }}>
              {filteredGroups.map((g) => (
                <div key={g.folder}>
                  <div
                    className="ui-row"
                    style={{ padding: "0 6px", marginBottom: 4, justifyContent: "space-between" }}
                  >
                    <span className="ty-sub" style={{ fontWeight: "var(--fw-med)" }}>
                      {g.label}
                    </span>
                    <span className="ty-sub tabular-nums">{g.items.length}</span>
                  </div>
                  <div className="ui-stack" style={{ gap: 2 }}>
                    {g.items.map((f) => {
                      const active = f.id === selectedId
                      return (
                        <button
                          key={f.id}
                          onClick={() => setSelectedId(f.id)}
                          className="ty-body"
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: active
                              ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                              : "transparent",
                            color: active ? "var(--accent)" : "var(--text)",
                            fontWeight: active ? "var(--fw-med)" : "var(--fw-body)",
                          }}
                        >
                          {f.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 좌측 하단 — 주간/야간 토글 */}
        <div style={{ padding: 10, borderTop: "1px solid var(--border-soft)" }}>
          <ThemeToggle theme={theme} onChange={changeTheme} />
        </div>
      </div>

      {/* 우측 — 상세 */}
      <div
        className="tin-scroll"
        style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: 24 }}
      >
        {selected ? (
          <DetailCard
            fav={selected.fav}
            busy={busy}
            onConnect={(f) => void connect(f)}
            onSaveMemo={saveMemo}
            folderLabel={selected.folderLabel}
          />
        ) : (
          <EmptyDetail
            text={totalCount === 0 ? "즐겨찾기를 먼저 추가하세요." : "왼쪽에서 캐릭터를 선택하세요"}
          />
        )}
      </div>
    </div>
  )
}
