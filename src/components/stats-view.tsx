import { Fragment, useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

import {
  getStatsMe,
  getStatsOthers,
  type CharStats,
  type LevelEvent,
  type StatsMe,
  type StatsOthers,
} from "@/lib/api"

/** 캐릭터 직업 (docs/00_개요.md 기준) */
const CLASS_OF: Record<string, string> = {
  // 천마신군그룹
  천마신군: "대부 · 리더/딜러",
  진풍백: "장군",
  한비광: "대부 · 리더/딜러",
  담화린: "교황 · 정신력 회복",
  최상희: "마왕 · 버프",
  초운현: "교황 · 평화",
  복병: "맵핑 전용",
}

/** 표시 순서 고정 — 한비광 / 담화린 / 최상희 */
const ORDER = ["한비광", "담화린", "최상희"]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoStr(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function fmt1(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : String(Math.round(v * 10) / 10)
}

export function StatsView() {
  const [tab, setTab] = useState<"me" | "others">("me")
  const [from, setFrom] = useState(daysAgoStr(6))
  const [to, setTo] = useState(todayStr())
  const [me, setMe] = useState<StatsMe | null>(null)
  const [others, setOthers] = useState<StatsOthers | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [m, o] = await Promise.all([
        getStatsMe(from, to),
        getStatsOthers(from, to),
      ])
      setMe(m)
      setOthers(o)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  const chars = [...(me?.characters ?? [])].sort((a, b) => {
    const ai = ORDER.indexOf(a.name)
    const bi = ORDER.indexOf(b.name)
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })

  // 게이지 공통 스케일 (캐릭 간 비교 가능하게)
  const maxCount = Math.max(1, ...chars.map((c) => c.count))
  const maxPerHour = Math.max(0.01, ...chars.map((c) => c.per_hour ?? 0))

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto p-5">
      {/* 상단 상태바 */}
      <div className="hud-panel hud-corner mb-5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div>
            <div
              className="tin-accent font-semibold tracking-widest"
              style={{ fontSize: "var(--tin-fs-lg)" }}
            >
              LEVEL-UP TELEMETRY
            </div>
            <div className="tin-mono" style={{ fontSize: "var(--tin-fs-sm)" }}>
              고블린 머드 · {me?.from ?? from} ~ {me?.to ?? to} · 총{" "}
              <span className="tin-accent">{me?.total ?? 0}</span>건
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-[var(--tin-edge)] p-0.5">
              {(["me", "others"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="rounded px-3 py-1.5 font-medium transition"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    background: tab === t ? "var(--tin-accent)" : "transparent",
                    color: tab === t ? "#06120c" : "var(--tin-fg)",
                  }}
                >
                  {t === "me" ? "내 캐릭터" : "남 캐릭터"}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="tin-mono rounded-md border border-[var(--tin-edge)] bg-transparent px-2 py-1.5 outline-none focus:border-[var(--tin-accent)]"
            />
            <span style={{ fontSize: "var(--tin-fs-sm)" }}>~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="tin-mono rounded-md border border-[var(--tin-edge)] bg-transparent px-2 py-1.5 outline-none focus:border-[var(--tin-accent)]"
            />
            <button
              onClick={() => void load()}
              className="flex items-center gap-1.5 rounded-md border border-[var(--tin-edge)] px-2.5 py-1.5 transition hover:border-[var(--tin-accent)]"
              style={{ fontSize: "var(--tin-fs-sm)" }}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              새로고침
            </button>
          </div>
        </div>
      </div>

      {tab === "me" ? (
        chars.length === 0 ? (
          <Empty text="이 기간에 기록된 레벨업이 없습니다. 레벨이 오르면 자동으로 쌓입니다." />
        ) : (
          chars.map((c) => (
            <CharConsole
              key={c.name}
              c={c}
              maxCount={maxCount}
              maxPerHour={maxPerHour}
            />
          ))
        )
      ) : (
        <OthersPanel others={others} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 캐릭터 콘솔 카드                                                     */
/* ------------------------------------------------------------------ */
function CharConsole({
  c,
  maxCount,
  maxPerHour,
}: {
  c: CharStats
  maxCount: number
  maxPerHour: number
}) {
  const pct = (v: number, m: number) =>
    Math.max(4, Math.min(100, Math.round((v / (m || 1)) * 100)))

  // 통계를 붙였지만 아직 레벨업 기록이 없는 캐릭터 —
  // 게이지·그래프를 그릴 값이 없으므로 간단한 안내 카드만 보여준다.
  if (c.pending) {
    return (
      <section className="hud-panel mb-6" style={{ opacity: 0.75 }}>
        <div className="hud-head">
          <span
            className="tin-accent font-bold tracking-wide"
            style={{ fontSize: "var(--tin-fs-lg)" }}
          >
            {c.name}
          </span>
          <span
            className="rounded-full border border-[var(--tin-edge)] px-2.5 py-0.5"
            style={{ fontSize: "var(--tin-fs-sm)" }}
          >
            {CLASS_OF[c.name] ?? "—"}
          </span>
          <span
            className="ml-auto tin-mono"
            style={{ fontSize: "var(--tin-fs-sm)" }}
          >
            기록 대기 (0회)
          </span>
        </div>
        <p className="px-4 py-3 leading-relaxed" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.8 }}>
          레벨업 통계를 붙여뒀지만 아직 기록이 없습니다.
          이 캐릭터가 레벨업하면 여기에 실제 수치가 채워집니다.
        </p>
      </section>
    )
  }

  return (
    <section className="hud-panel mb-6">
      {/* 헤더 */}
      <div className="hud-head">
        <span
          className="tin-accent font-bold tracking-wide"
          style={{ fontSize: "var(--tin-fs-lg)" }}
        >
          {c.name}
        </span>
        <span
          className="rounded-full border border-[var(--tin-edge)] px-2.5 py-0.5"
          style={{ fontSize: "var(--tin-fs-sm)" }}
        >
          {CLASS_OF[c.name] ?? "—"}
        </span>
        <div className="ml-auto text-right">
          <div
            className="tin-accent tin-mono font-bold leading-none"
            style={{ fontSize: "var(--tin-fs-xl)" }}
          >
            {c.latest_level}
          </div>
          <div style={{ fontSize: "var(--tin-fs-sm)", letterSpacing: "1.4px" }}>
            CURRENT LEVEL
          </div>
        </div>
      </div>

      {/* 게이지 */}
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <Gauge
          label="기간 레벨업"
          value={String(c.count)}
          barPct={pct(c.count, maxCount)}
          note={`최고 ${maxCount} 기준`}
        />
        <Gauge
          label="시간당"
          value={fmt1(c.per_hour)}
          unit="렙"
          barPct={pct(c.per_hour ?? 0, maxPerHour)}
          note="첫~마지막 레벨업 구간 기준"
        />
        <Gauge
          label="평균 간격"
          value={fmt1(c.gap_avg_min)}
          unit="분"
          barPct={pct(180 - Math.min(180, c.gap_avg_min ?? 180), 180)}
          note="짧을수록 효율 좋음"
        />
        <Gauge
          label="간격 최소/최대"
          value={`${fmt1(c.gap_min_min)}/${fmt1(c.gap_max_min)}`}
          barPct={pct(c.gap_min_min ?? 0, c.gap_max_min ?? 1)}
          note="분 단위"
        />
        <Gauge
          label="오늘"
          value={String(c.today_count)}
          unit="렙"
          barPct={pct(c.today_count, Math.max(1, maxCount / 7) * 1.6)}
          note={c.last_at?.slice(0, 10) ?? ""}
        />
      </div>

      {/* 레벨업 추이 */}
      <div className="px-4">
        <p className="hud-sect">LEVEL PROGRESSION · 레벨업 추이</p>
      </div>
      <LevelChart events={c.events ?? []} />

      {/* 시계열 표 */}
      <div className="px-4">
        <p className="hud-sect">
          TIME SERIES · 시각별 상승치 · 하루 소계 · 주간 합계
        </p>
      </div>
      <StatTable events={c.events ?? []} />
    </section>
  )
}

function Gauge({
  label,
  value,
  unit,
  barPct,
  note,
}: {
  label: string
  value: string
  unit?: string
  barPct: number
  note?: string
}) {
  return (
    <div className="hud-gauge">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span style={{ fontSize: "var(--tin-fs-sm)", letterSpacing: "1.2px" }}>
          {label}
        </span>
        <span className="tin-accent tin-mono font-bold">
          {value}
          {unit && (
            <span style={{ fontSize: "var(--tin-fs-sm)", fontWeight: 400 }}>
              {" "}
              {unit}
            </span>
          )}
        </span>
      </div>
      <div className="hud-bar">
        <i style={{ width: `${barPct}%` }} />
      </div>
      {note && (
        <div className="mt-1.5" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.75 }}>
          {note}
        </div>
      )}
    </div>
  )
}

/** 레벨업 추이: 시각 순 누적 레벨 + 그 시점 능력치 */
function LevelChart({ events }: { events: LevelEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="px-4 pb-4" style={{ fontSize: "var(--tin-fs-sm)" }}>
        데이터 없음
      </div>
    )
  }
  const data = events.map((e, i) => ({
    idx: i + 1,
    label: `${e.date.slice(5)} ${e.time.slice(0, 5)}`,
    level: e.level,
    hp: e.hp,
  }))
  const accent =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--tin-accent")
      .trim() || "#3ddc84"

  return (
    <div className="h-56 px-4 pb-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#102a1f" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#ffffff" }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#ffffff" }}
            domain={["dataMin - 1", "dataMax + 1"]}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "#0b1f17",
              border: "1px solid #14503a",
              borderRadius: 8,
              fontSize: 12,
              color: "#ffffff",
            }}
            labelStyle={{ color: accent }}
          />
          <Line
            type="monotone"
            dataKey="level"
            name="레벨"
            stroke={accent}
            strokeWidth={2}
            dot={{ r: 2, fill: accent }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 시각·레벨·체/마/이/수 + 하루 소계 + 주간 합계 */
function StatTable({ events }: { events: LevelEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="px-4 pb-4" style={{ fontSize: "var(--tin-fs-sm)" }}>
        데이터 없음
      </div>
    )
  }

  // 날짜별 묶기
  const byDay = new Map<string, LevelEvent[]>()
  for (const e of events) {
    const arr = byDay.get(e.date) ?? []
    arr.push(e)
    byDay.set(e.date, arr)
  }

  const total = events.reduce(
    (a, e) => ({
      n: a.n + 1,
      hp: a.hp + e.hp,
      mp: a.mp + e.mp,
      mv: a.mv + e.mv,
      tr: a.tr + e.tr,
    }),
    { n: 0, hp: 0, mp: 0, mv: 0, tr: 0 },
  )

  const num = (v: number) => (
    <span className={v === 0 ? "hud-zero" : undefined}>{v}</span>
  )

  return (
    <div className="mx-4 mb-4 max-h-80 overflow-auto rounded-lg border border-[var(--tin-edge-soft)] tin-scroll">
      <table className="hud-table tin-mono">
        <thead>
          <tr>
            <th className="c1">시각</th>
            <th>레벨</th>
            <th>체력</th>
            <th>마력</th>
            <th>이동</th>
            <th>수련</th>
          </tr>
        </thead>
        <tbody>
          {[...byDay.entries()].map(([date, list]) => {
            const sub = list.reduce(
              (a, e) => ({
                hp: a.hp + e.hp,
                mp: a.mp + e.mp,
                mv: a.mv + e.mv,
                tr: a.tr + e.tr,
              }),
              { hp: 0, mp: 0, mv: 0, tr: 0 },
            )
            return (
              <Fragment key={date}>
                <tr className="hud-dayrow">
                  <td className="c1" colSpan={6}>
                    {date} · {list.length}렙업
                  </td>
                </tr>
                {list.map((e) => (
                  <tr key={`${date}-${e.at}`}>
                    <td className="c1">{e.time}</td>
                    <td>{e.level}</td>
                    <td>{num(e.hp)}</td>
                    <td>{num(e.mp)}</td>
                    <td>{num(e.mv)}</td>
                    <td>{num(e.tr)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="c1 tin-accent">└ 하루 소계</td>
                  <td className="tin-accent">{list.length}렙</td>
                  <td className="tin-accent">{sub.hp}</td>
                  <td className="tin-accent">{sub.mp}</td>
                  <td className="tin-accent">{sub.mv}</td>
                  <td className="tin-accent">{sub.tr}</td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="c1">주간 합계</td>
            <td>{total.n}렙</td>
            <td>{total.hp}</td>
            <td>{total.mp}</td>
            <td>{total.mv}</td>
            <td>{total.tr}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function OthersPanel({ others }: { others: StatsOthers | null }) {
  return (
    <>
      <div
        className="hud-panel mb-4 px-4 py-2.5"
        style={{ fontSize: "var(--tin-fs-sm)" }}
      >
        {others?.note ??
          "게임이 남 캐릭터의 능력치 상승치는 알려주지 않아 이름·시각만 기록된다."}
      </div>
      {(others?.people.length ?? 0) === 0 ? (
        <Empty text="이 기간에 관측된 남 캐릭터 레벨업이 없습니다." />
      ) : (
        <div className="hud-panel overflow-x-auto">
          <table className="hud-table tin-mono">
            <thead>
              <tr>
                <th className="c1">순위</th>
                <th className="c1">이름</th>
                <th>레벨업</th>
                <th>평균 간격</th>
                <th className="c1">최근 시각</th>
                <th className="c1">능력치</th>
              </tr>
            </thead>
            <tbody>
              {others?.people.map((p, i) => (
                <tr key={p.name}>
                  <td className="c1">{i + 1}</td>
                  <td className="c1 tin-accent">{p.name}</td>
                  <td>{p.count}</td>
                  <td>{fmt1(p.gap_avg_min)}분</td>
                  <td className="c1">{p.last_at}</td>
                  <td className="c1" style={{ opacity: 0.7 }}>
                    게임 미제공
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="hud-panel px-4 py-12 text-center">
      <span style={{ fontSize: "var(--tin-fs-sm)" }}>{text}</span>
    </div>
  )
}
