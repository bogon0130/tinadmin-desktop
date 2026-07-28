import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import {
  Bar,
  BarChart,
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
  type StatsMe,
  type StatsOthers,
} from "@/lib/api"

const GREEN = "#4ade80"
const COLORS = ["#4ade80", "#38bdf8", "#f5a97f", "#c6a0f6"]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoStr(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function fmt(v: number | null | undefined, suffix = "") {
  return v === null || v === undefined ? "—" : `${v}${suffix}`
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

  // 효율 순 = 평균 간격 짧은 순 (간격 없는 캐릭은 뒤로)
  const ranked: CharStats[] = [...(me?.characters ?? [])].sort((a, b) => {
    const av = a.gap_avg_min ?? Number.MAX_SAFE_INTEGER
    const bv = b.gap_avg_min ?? Number.MAX_SAFE_INTEGER
    return av - bv
  })

  // 시간대별 그래프용 (0~23시, 캐릭별 시리즈)
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const row: Record<string, number | string> = { hour: `${h}시` }
    for (const c of me?.characters ?? []) row[c.name] = c.hourly[h] ?? 0
    return row
  })

  // 하루별 능력치 누적 (전 캐릭 합산)
  const dayMap = new Map<string, { date: string; hp: number; mp: number; mv: number; tr: number }>()
  for (const c of me?.characters ?? []) {
    for (const d of c.daily) {
      const cur = dayMap.get(d.date) ?? { date: d.date, hp: 0, mp: 0, mv: 0, tr: 0 }
      cur.hp += d.hp
      cur.mp += d.mp
      cur.mv += d.mv
      cur.tr += d.tr
      dayMap.set(d.date, cur)
    }
  }
  const dailyData = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto p-5">
      {/* 탭 + 기간 */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border p-0.5">
          {(["me", "others"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "me" ? "내 캐릭터" : "남 캐릭터"}
            </button>
          ))}
        </div>

        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="font-mono-tin rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
        />
        <span className="text-xs text-muted-foreground">~</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="font-mono-tin rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
        />
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:bg-secondary"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          새로고침
        </button>
      </div>

      {tab === "me" ? (
        <>
          {(me?.characters.length ?? 0) === 0 ? (
            <EmptyBox text="이 기간에 기록된 레벨업이 없습니다. 레벨이 오르면 자동으로 쌓입니다." />
          ) : (
            <>
              {/* 캐릭별 카드 */}
              <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {me?.characters.map((c) => (
                  <div
                    key={c.name}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="mb-3 flex items-baseline justify-between">
                      <span className="font-mono-tin text-sm font-semibold text-primary">
                        {c.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Lv.{c.latest_level}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Metric label="오늘" value={String(c.today_count)} unit="렙" />
                      <Metric
                        label="평균간격"
                        value={fmt(c.gap_avg_min)}
                        unit="분"
                      />
                      <Metric
                        label="시간당"
                        value={fmt(c.per_hour)}
                        unit="렙"
                      />
                    </div>
                    <div className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
                      기간 {c.count}렙업 · 체{c.totals.hp} 마{c.totals.mp} 이
                      {c.totals.mv} 수{c.totals.tr}
                    </div>
                  </div>
                ))}
              </div>

              {/* 비교 표 */}
              <SectionTitle>캐릭터 비교 (효율 순 — 평균 간격 짧은 순)</SectionTitle>
              <div className="mb-6 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      {["#", "캐릭터", "레벨업", "최근Lv", "평균간격", "최소", "최대", "시간당", "렙당 체/마/이/수"].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((c, i) => (
                      <tr
                        key={c.name}
                        className="h-10 border-t border-border/60 hover:bg-secondary/40"
                      >
                        <td className="px-3 text-[13px] text-muted-foreground">
                          {i + 1}
                        </td>
                        <td className="font-mono-tin px-3 text-[13px] font-semibold text-primary">
                          {c.name}
                        </td>
                        <td className="font-mono-tin px-3 text-[13px]">{c.count}</td>
                        <td className="font-mono-tin px-3 text-[13px]">
                          {c.latest_level}
                        </td>
                        <td className="font-mono-tin px-3 text-[13px]">
                          {fmt(c.gap_avg_min, "분")}
                        </td>
                        <td className="font-mono-tin px-3 text-[13px] text-muted-foreground">
                          {fmt(c.gap_min_min, "분")}
                        </td>
                        <td className="font-mono-tin px-3 text-[13px] text-muted-foreground">
                          {fmt(c.gap_max_min, "분")}
                        </td>
                        <td className="font-mono-tin px-3 text-[13px]">
                          {fmt(c.per_hour)}
                        </td>
                        <td className="font-mono-tin px-3 text-[13px] text-muted-foreground">
                          {c.avg_per_level.hp}/{c.avg_per_level.mp}/
                          {c.avg_per_level.mv}/{c.avg_per_level.tr}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 시간대별 추이 */}
              <SectionTitle>
                시간대별 레벨업 추이 (몇 시에 잘 오르나 = 리젠 파악)
              </SectionTitle>
              <ChartBox>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f2b" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#8b968d" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8b968d" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#1c211d",
                      border: "1px solid #333",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  {(me?.characters ?? []).map((c, i) => (
                    <Bar
                      key={c.name}
                      dataKey={c.name}
                      stackId="a"
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ChartBox>

              {/* 하루별 능력치 */}
              <SectionTitle>하루별 능력치 상승 합계 (전 캐릭터)</SectionTitle>
              <ChartBox>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f2b" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8b968d" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#8b968d" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#1c211d",
                      border: "1px solid #333",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="hp" name="체력" stroke={GREEN} strokeWidth={2} />
                  <Line type="monotone" dataKey="mp" name="마력" stroke="#38bdf8" strokeWidth={2} />
                  <Line type="monotone" dataKey="mv" name="이동" stroke="#f5a97f" strokeWidth={2} />
                  <Line type="monotone" dataKey="tr" name="수련" stroke="#c6a0f6" strokeWidth={2} />
                </LineChart>
              </ChartBox>
            </>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 rounded-md border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
            {others?.note ??
              "게임이 남 캐릭터의 능력치 상승치는 알려주지 않아 이름·시각만 기록된다."}
          </div>
          {(others?.people.length ?? 0) === 0 ? (
            <EmptyBox text="이 기간에 관측된 남 캐릭터 레벨업이 없습니다." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary">
                  <tr>
                    {["순위", "이름", "레벨업 횟수", "평균 간격", "최근 시각", "능력치"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {others?.people.map((p, i) => (
                    <tr
                      key={p.name}
                      className="h-10 border-t border-border/60 hover:bg-secondary/40"
                    >
                      <td className="px-3 text-[13px] text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="font-mono-tin px-3 text-[13px] font-semibold text-primary">
                        {p.name}
                      </td>
                      <td className="font-mono-tin px-3 text-[13px]">{p.count}</td>
                      <td className="font-mono-tin px-3 text-[13px]">
                        {fmt(p.gap_avg_min, "분")}
                      </td>
                      <td className="font-mono-tin px-3 text-[13px] text-muted-foreground">
                        {p.last_at}
                      </td>
                      <td className="px-3 text-[12px] text-muted-foreground">
                        게임 미제공
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit: string
}) {
  return (
    <div>
      <div className="font-mono-tin text-lg font-semibold text-foreground">
        {value}
        <span className="ml-0.5 text-[10px] text-muted-foreground">{unit}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-sm font-semibold text-foreground">{children}</h3>
  )
}

function ChartBox({ children }: { children: React.ReactElement }) {
  return (
    <div className="mb-6 h-64 rounded-lg border border-border bg-card p-3">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}
