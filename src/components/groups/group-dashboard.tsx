import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Loader2, RefreshCw, Server } from "lucide-react"
import { toast } from "sonner"

import { getStatsMe, type CharStats } from "@/lib/api"
import { getGroups, type GroupInfo } from "@/lib/groups"

/**
 * 그룹 대시보드 — 24시간 자동사냥 그룹(한비광그룹/천마신군그룹) 실시간 현황.
 *
 * 1단계는 "정보 표시"만 한다. 재접속 버튼도 메모 저장도 없다 — 그건 다음 단계.
 *
 * 데이터는 이미 있는 두 API 를 그대로 쓴다:
 *   GET /api/groups    — tmux 실시간 상태 (읽기 전용, 서버가 list-windows 로 조회)
 *   GET /api/stats/me  — 레벨업 통계 (stats.log 집계)
 * 새 서버 라우트는 만들지 않았다.
 */

/** 캐릭터 역할 — stats-view.tsx 의 CLASS_OF 와 같은 값을 쓰고,
 *  거기 없던 천마신군그룹 나머지 4명은 tin 파일명 접두어(대부_/장군_/교황_ 등)로 채웠다. */
const ROLE_OF: Record<string, string> = {
  한비광: "대부 · 리더/딜러",
  담화린: "교황 · 정신력 회복",
  최상희: "마왕 · 버프",
  초운현: "교황 · 평화",
  천마신군: "대부 · 리더/딜러",
  진풍백: "장군",
  커: "보조",
  매유진: "마왕",
  벽력자: "교황",
  천운악: "교황",
}

/**
 * 콤보 파일 경로 — 두 그룹 다 tin/{그룹명}/combo/{캐릭터명}.tin 형태로 실존한다
 * (1단계 조사에서 확인). config.py 의 GROUPS[...].dir 은 한비광그룹이 ""
 * 라서 여기 쓰기엔 신뢰할 수 없다 — 실제 폴더명은 그룹 표시명과 같다.
 */
function comboPath(groupName: string, charName: string): string {
  return `tin/${groupName}/combo/${charName}.tin`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoStr(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** 카드에 보여줄 순서 — 살아있으면 실제 tmux 창번호 순서, 죽어있으면 설정 순서(복병 제외). */
function orderedNames(g: GroupInfo): string[] {
  if (g.live && g.live_windows.length > 0) return g.live_windows
  // 세션이 꺼져 있을 때의 대체 순서. "복병"은 config.py GROUPS 에 등록만 되어
  //있고 실제 창은 없는 알려진 설정 오류라 항상 제외한다(1단계 조사 결과).
  return g.windows.filter((w) => w !== "복병")
}

export function GroupDashboard({ groupName }: { groupName: string }) {
  const [group, setGroup] = useState<GroupInfo | null>(null)
  const [groupLoading, setGroupLoading] = useState(true)
  const [from, setFrom] = useState(daysAgoStr(6))
  const [to, setTo] = useState(todayStr())
  const [chars, setChars] = useState<CharStats[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  const loadGroup = useCallback(async () => {
    setGroupLoading(true)
    const all = await getGroups()
    setGroup(all.find((g) => g.name === groupName) ?? null)
    setGroupLoading(false)
  }, [groupName])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const d = await getStatsMe(from, to)
      setChars(d.characters)
    } catch (e) {
      toast.error("통계를 불러오지 못했습니다", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setStatsLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void loadGroup()
  }, [loadGroup])
  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const order = useMemo(() => (group ? orderedNames(group) : []), [group])
  const charByName = useMemo(() => {
    const m = new Map<string, CharStats>()
    for (const c of chars) m.set(c.name, c)
    return m
  }, [chars])
  const liveByName = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const c of group?.characters ?? []) m.set(c.name, c.live)
    return m
  }, [group])

  const liveCount = order.filter((n) => liveByName.get(n)).length
  const allLive = order.length > 0 && liveCount === order.length

  // 그룹 합계 — 통계가 붙은(has_stats) 캐릭터만. 아직 기록 없는 캐릭터(pending)는 0으로 이미 채워져 있다.
  const statCharNames = new Set(
    (group?.characters ?? []).filter((c) => c.has_stats).map((c) => c.name),
  )
  const trackedChars = chars.filter((c) => statCharNames.has(c.name))
  const totals = trackedChars.reduce(
    (acc, c) => ({
      count: acc.count + c.count,
      hp: acc.hp + c.totals.hp,
      mp: acc.mp + c.totals.mp,
      mv: acc.mv + c.totals.mv,
    }),
    { count: 0, hp: 0, mp: 0, mv: 0 },
  )

  // 그룹 일별 레벨업 추이 — 캐릭터별 daily[] 를 날짜 기준으로 합산한다.
  const dailyTotal = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of trackedChars) {
      for (const d of c.daily) m.set(d.date, (m.get(d.date) ?? 0) + d.count)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({
      date: date.slice(5),
      count,
    }))
  }, [trackedChars])

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto" style={{ padding: "var(--gap-sec)" }}>
      <div className="ui-sections">
        {/* 상단바 */}
        <div className="cc-panel">
          <div className="ui-row" style={{ flexWrap: "wrap", gap: "var(--gap)" }}>
            <span className="ty-h" style={{ fontFamily: "var(--font-display)" }}>
              {groupName}
            </span>
            {group && (
              <span className="cc-tag" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Server className="size-3" />
                SESSION <b style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>{group.session}</b>
              </span>
            )}
            {!groupLoading && group && (
              <span className={`cc-badge ${allLive ? "ok" : "off"}`}>
                창 {liveCount}/{order.length} {allLive ? "정상" : "일부 중단"}
              </span>
            )}
            {groupLoading && <Loader2 className="size-4 animate-spin" style={{ color: "var(--cyan)" }} />}

            <div className="ui-row" style={{ marginLeft: "auto", gap: 8 }}>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="cc-btn"
                style={{ colorScheme: "dark" }}
              />
              <span className="ty-sub">~</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="cc-btn"
                style={{ colorScheme: "dark" }}
              />
              <button
                onClick={() => {
                  void loadGroup()
                  void loadStats()
                }}
                className="cc-btn"
                title="새로고침"
              >
                {groupLoading || statsLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                새로고침
              </button>
            </div>
          </div>
        </div>

        {/* 본문: 왼쪽 캐릭터 카드 + 오른쪽 그룹 종합 */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: "var(--gap-sec)" }}>
          {/* 왼쪽 — 캐릭터 카드 세로 나열 (실제 tmux 창번호 순서) */}
          <div className="ui-stack-lg">
            {order.length === 0 && !groupLoading && (
              <div className="cc-panel ty-sub">그룹 정보를 불러오지 못했습니다.</div>
            )}
            {order.map((name, idx) => (
              <CharCard
                key={name}
                windowIndex={idx}
                session={group?.session ?? ""}
                name={name}
                groupName={groupName}
                live={liveByName.get(name) ?? false}
                stat={charByName.get(name)}
                hasStats={statCharNames.has(name)}
              />
            ))}
          </div>

          {/* 오른쪽 — 그룹 종합 */}
          <div className="ui-stack-lg">
            <div className="cc-panel">
              <span className="cc-panel-title">GROUP TOTALS · 그룹 합계</span>
              <div className="cc-stats" style={{ marginTop: 12, flexWrap: "wrap" }}>
                <span>
                  레벨업 <b>{totals.count}</b>
                </span>
                <span>
                  체력 <b>+{totals.hp.toLocaleString()}</b>
                </span>
                <span>
                  마력 <b>+{totals.mp.toLocaleString()}</b>
                </span>
                <span>
                  이동 <b>+{totals.mv.toLocaleString()}</b>
                </span>
              </div>
              <div className="ty-sub" style={{ marginTop: 8 }}>
                통계 대상 {trackedChars.length}명 · {from} ~ {to}
              </div>
            </div>

            <div className="cc-panel">
              <span className="cc-panel-title">DAILY LEVEL-UPS · 그룹 일별 레벨업</span>
              <GroupTrendChart data={dailyTotal} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupTrendChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="ty-sub" style={{ padding: "24px 0", textAlign: "center" }}>
        이 기간에 기록된 레벨업이 없습니다.
      </div>
    )
  }
  return (
    <div style={{ height: 220, marginTop: 12 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#DDF6FB" }} minTickGap={16} />
          <YAxis tick={{ fontSize: 10, fill: "#DDF6FB" }} allowDecimals={false} width={28} />
          <Tooltip
            contentStyle={{
              background: "#0b1420",
              border: "1px solid rgba(63,230,255,0.28)",
              borderRadius: 4,
              fontSize: 12,
              color: "#DDF6FB",
            }}
            labelStyle={{ color: "#3FE6FF" }}
          />
          <Line
            type="monotone"
            dataKey="count"
            name="레벨업"
            stroke="#3FE6FF"
            strokeWidth={2}
            dot={{ r: 2, fill: "#3FE6FF" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 목표(체력/정신력/이동력 각 10만) — 계산 파라미터 */
const GOAL = 100_000

function fmt1(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : String(Math.round(v * 10) / 10)
}

/**
 * 실제 경과 일수 — 첫 기록 ~ 마지막 기록 사이 날짜 수(양끝 포함, 최소 1일).
 *
 * ★하루치만 쓰지 않는 이유★
 *   렙업이 뜸한 날은 일평균이 0에 가깝게 튀거나(그날만 보면) 반대로
 *   몰아서 오른 날만 보면 과대평가된다. 기간 전체 증가량을 실제 경과
 *   일수로 나눠야 "요즘 하루에 이만큼 는다"는 값이 안정적으로 나온다.
 */
function elapsedDays(stat: CharStats): number {
  if (!stat.first_at || !stat.last_at) return 0
  const a = new Date(stat.first_at.replace(" ", "T")).getTime()
  const b = new Date(stat.last_at.replace(" ", "T")).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(1, Math.floor((b - a) / 86_400_000) + 1)
}

/** 일수를 "약 N일 / N개월 / N년 M개월"로. 큰 값은 개월·년으로 접어야 카드가 안 늘어난다. */
function formatEta(days: number): string {
  if (days < 60) return `약 ${Math.round(days)}일`
  if (days < 365) return `약 ${Math.round(days / 30)}개월`
  const years = Math.floor(days / 365)
  let months = Math.round((days - years * 365) / 30)
  let y = years
  if (months >= 12) {
    y += 1
    months = 0
  }
  return months > 0 ? `약 ${y}년 ${months}개월` : `약 ${y}년`
}

/**
 * 목표(10만) 도달 예상 — 카드에서 제일 눈에 띄어야 하는 값이라 별도 컴포넌트로 뺐다.
 *
 * total===0 은 두 가지 경우를 구분해야 한다:
 *   - 체력/이동력이 0 : 이 기간에 안 올랐을 뿐이니 "측정 대기"로 표시(칸은 유지)
 *   - 마력이 0        : stats.log 를 보면 마력 없는 직업(대부 등, 예: 한비광)은
 *                        전 기간 항상 0이다 — 칸 자체를 숨긴다(hideIfZero)
 */
function GoalEta({
  label,
  total,
  days,
  hue,
  hideIfZero,
}: {
  label: string
  total: number
  days: number
  hue: number
  hideIfZero?: boolean
}) {
  const rate = days > 0 ? total / days : 0
  if (rate <= 0 && hideIfZero) return null

  return (
    <div className="cc-gauge" style={{ ["--ghue" as string]: hue }}>
      <div className="ty-sub" style={{ letterSpacing: "1px" }}>
        {label} 10만까지
      </div>
      {rate > 0 ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--cyan)",
            lineHeight: 1.3,
          }}
        >
          {formatEta(GOAL / rate)}
        </div>
      ) : (
        <div className="ty-sub" style={{ fontSize: 13 }}>
          측정 대기
        </div>
      )}
      <div className="ty-sub" style={{ fontSize: 10, marginTop: 2 }}>
        일평균 +{Math.round(rate).toLocaleString()}
      </div>
    </div>
  )
}

function CharCard({
  windowIndex,
  session,
  name,
  groupName,
  live,
  stat,
  hasStats,
}: {
  windowIndex: number
  session: string
  name: string
  groupName: string
  live: boolean
  stat: CharStats | undefined
  hasStats: boolean
}) {
  const pending = !stat || stat.pending
  return (
    <article className="cc-card">
      <div className="cc-head">
        <span className={`cc-dot ${live ? "on" : "off"}`} />
        <span className="cc-name">{name}</span>
        <span className="cc-job">{ROLE_OF[name] ?? "-"}</span>
        <span
          className="ty-num"
          style={{ marginLeft: "auto", fontSize: 20, color: pending ? "var(--text-dim)" : "var(--cyan)" }}
        >
          {stat && !pending ? stat.latest_level : "-"}
        </span>
      </div>

      <div className="cc-tags">
        <span className="cc-tag" style={{ fontFamily: "var(--font-mono)" }}>
          {session}:{windowIndex}
        </span>
        <span className="cc-tag" style={{ fontFamily: "var(--font-mono)" }} title={comboPath(groupName, name)}>
          combo/{name}.tin
        </span>
      </div>

      {!hasStats ? (
        <div className="ty-sub" style={{ marginTop: 4 }}>
          레벨업 통계 미연동 — 상태만 표시됩니다.
        </div>
      ) : pending ? (
        <div className="ty-sub" style={{ marginTop: 4 }}>
          통계 연동됨 · 이 기간 기록 없음
        </div>
      ) : (
        <>
          <div className="cc-stats" style={{ marginTop: 4, marginBottom: 6 }}>
            <span>
              오늘 <b>{stat.today_count}</b>
            </span>
            <span>
              시간당 <b>{stat.per_hour ?? "-"}</b>
            </span>
            <span>
              기간 <b>{stat.count}</b>
            </span>
          </div>

          {/* 레벨업 평균 간격 — 이미 서버가 계산해 주는 값을 그대로 표기만 한다 */}
          <div className="ty-sub" style={{ marginBottom: 10 }}>
            레벨업 주기: 평균 <b style={{ color: "var(--text)" }}>{fmt1(stat.gap_avg_min)}</b>분
          </div>

          {/* 레벨업 1회당 평균 증가량 — 캐릭터 사이 비교가 되는 값이라 게이지로 보여준다 */}
          <StatGauges avg={stat.avg_per_level} />

          {/* 목표(체력/정신력/이동력 10만) 도달 예상 — 카드에서 가장 강조되는 지표 */}
          <div
            className="cc-gauges"
            style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-soft)" }}
          >
            <GoalEta label="체력" total={stat.totals.hp} days={elapsedDays(stat)} hue={150} />
            <GoalEta
              label="정신력"
              total={stat.totals.mp}
              days={elapsedDays(stat)}
              hue={190}
              hideIfZero
            />
            <GoalEta label="이동력" total={stat.totals.mv} days={elapsedDays(stat)} hue={45} />
          </div>
        </>
      )}
    </article>
  )
}

/** 레벨업당 평균 체력/마력/이동 증가량 게이지 — 세 값의 상대 크기만 보여준다(절대비교 아님). */
function StatGauges({ avg }: { avg: { hp: number; mp: number; mv: number } }) {
  const max = Math.max(1, avg.hp, avg.mp, avg.mv)
  const rows: [string, number, number][] = [
    ["체력", avg.hp, 150],
    ["마력", avg.mp, 190],
    ["이동", avg.mv, 45],
  ]
  return (
    <div className="cc-gauges">
      {rows.map(([label, v, hue]) => (
        <div key={label} className="cc-gauge" style={{ ["--ghue" as string]: hue }}>
          <div className="cc-gauge-label">
            <span>{label}</span>
            <b>+{v}</b>
          </div>
          <div className="cc-gauge-bar">
            <div className="cc-gauge-fill" style={{ width: `${Math.max(4, Math.round((v / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
