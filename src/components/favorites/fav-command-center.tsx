import { useEffect, useMemo, useState } from "react"
import { Loader2, PlugZap, StickyNote } from "lucide-react"

import type { Favorite } from "@/lib/favorites"
import { EMPTY_STAT, getFavStat, type FavStat } from "@/lib/favstats"
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

/**
 * 캐릭터 직업 — tin 파일 경로의 폴더로 판별한다 (2_장군/담신우.tin -> 장군).
 *
 * 즐겨찾기의 folder 값도 지금은 같지만, 그건 사용자가 화면에서 옮길 수 있는
 * "분류함"이라 실제 직업과 어긋날 수 있다. 직업은 어느 자반을 읽는지가 정하므로
 * tin 경로를 근거로 삼는다.
 */
const JOBS = ["장군", "대부", "교황", "마왕"] as const
type Job = (typeof JOBS)[number]

function jobOf(f: Favorite): Job | null {
  for (const path of f.files) {
    const m = path.match(/^2_([^/]+)\//)
    if (m && (JOBS as readonly string[]).includes(m[1])) return m[1] as Job
  }
  return null
}

/**
 * 최대 능력치 — 게임에서 "점수"를 치면 서버에 저장된 값을 읽어 숫자로만 보여준다.
 *
 * 막대 게이지를 쓰지 않는 이유: 보여줄 게 "최대값"뿐이라 채울 비율이 없다.
 * 빈 막대는 "0" 처럼 잘못 읽히기만 한다.
 *
 * 아직 접속해서 점수를 치지 않은 캐릭터는 값이 없다 -> "-".
 */
function MaxStats({ id }: { id: string }) {
  const [stat, setStat] = useState<FavStat>(EMPTY_STAT)

  useEffect(() => {
    let alive = true
    void getFavStat(id).then((s) => {
      // 카드가 사라진 뒤 늦게 온 응답으로 상태를 건드리지 않는다
      if (alive) setStat(s)
    })
    return () => {
      alive = false
    }
  }, [id])

  const fmt = (v: number | null) => (v === null ? "-" : v.toLocaleString())

  return (
    <div className="cc-stats" style={{ marginBottom: 10 }}>
      <span>
        체력 <b>{fmt(stat.hpMax)}</b>
      </span>
      <span>
        마력 <b>{fmt(stat.mpMax)}</b>
      </span>
      <span>
        이동 <b>{fmt(stat.mvMax)}</b>
      </span>
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
          style={{ marginTop: 3, color: "var(--cyan-dim)" }}
        />
        {/* 빈 메모도 흐리게 하지 않는다 — "메모 추가"가 안 읽히면 누를 수 있는지도 모른다 */}
        <span style={{ minWidth: 0, flex: 1 }}>
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
  const { groups, loading, busy, connect, saveMemo } = useFavorites(reloadKey)
  /** null = 전체 */
  const [job, setJob] = useState<Job | null>(null)

  // 고른 직업만 남긴다. 섹션이 통째로 비면 그 섹션도 감춘다.
  const shown = useMemo(() => {
    if (job === null) return groups
    return groups
      .map((g) => ({ ...g, items: g.items.filter((f) => jobOf(f) === job) }))
      .filter((g) => g.items.length > 0)
  }, [groups, job])

  // 탭에 개수를 같이 보여준다 — 필터가 걸렸을 때 몇 개가 빠졌는지 알 수 있게
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    let all = 0
    for (const g of groups)
      for (const f of g.items) {
        all++
        const j = jobOf(f)
        if (j) m.set(j, (m.get(j) ?? 0) + 1)
      }
    return { all, byJob: m }
  }, [groups])

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
      {/* 직업 필터 */}
      <div className="cc-tabs">
        <button
          onClick={() => setJob(null)}
          className={`cc-tab${job === null ? " is-on" : ""}`}
        >
          전체 <span className="cc-tab-n">{counts.all}</span>
        </button>
        {JOBS.map((j) => (
          <button
            key={j}
            onClick={() => setJob(j)}
            className={`cc-tab${job === j ? " is-on" : ""}`}
          >
            {j} <span className="cc-tab-n">{counts.byJob.get(j) ?? 0}</span>
          </button>
        ))}
      </div>

      {shown.map((g) => (
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
              const job = jobOf(f)
              return (
                <article key={f.id} className="cc-card">
                  {/* 머리 — 상태점 + 이름 + 직업 */}
                  <div className="cc-head">
                    <span className="cc-dot on" />
                    <span className="cc-name">{f.name}</span>
                    {job && <span className="cc-job">{job}</span>}
                  </div>

                  <MemoLine fav={f} onSave={saveMemo} />

                  {/* 태그 — 폴더 */}
                  <div className="cc-tags">
                    <span className="cc-tag">{g.label}</span>
                  </div>

                  {/* 최대 능력치 — 서버 /api/favstats/<id> */}
                  <MaxStats id={f.id} />

                  {/* 수치 */}
                  <div className="cc-stats">
                    <span>
                      FILES <b>{f.files.length}</b>
                    </span>
                    <span>
                      COMBO <b>{f.combo}</b>
                    </span>
                  </div>

                  {/* 메타 — 세션 */}
                  <div className="cc-meta">
                    <div className="cc-meta-item">
                      <span className="cc-meta-k">SESSION</span>
                      <span className="cc-meta-v">{f.session || "-"}</span>
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
