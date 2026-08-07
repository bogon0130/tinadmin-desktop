import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Copy, Loader2, RefreshCw, Server } from "lucide-react"
import { toast } from "sonner"

import { getStatsMe, type CharStats, type LevelEvent } from "@/lib/api"
import { getGroups, type GroupInfo } from "@/lib/groups"
import { EMPTY_STAT, getFavStat, type FavStat } from "@/lib/favstats"

/**
 * 그룹 캐릭터 5명의 stats_fav id.
 *
 * 즐겨찾기 캐릭터와 달리 이 5명은 favorites.json 에 없어 앱이 만들어주는
 * id 가 없다 — 그래서 여기서 직접 정했다. features/favstats.py 의
 * read_stat() 은 favorites.json 을 전혀 보지 않고 이 문자열을 그대로
 * 파일명으로만 쓰므로(검증 완료), "grp-" 접두어를 붙인 로마자 슬러그면
 * 무엇이든 된다. tin 쪽 #system echo 의 대상 파일명과 반드시 같아야 한다
 * (한비광그룹/{한비광,담화린,최상희}.tin, 천마신군그룹/{대부_천마신군,
 * 장군_진풍백}.tin 끝에 심어둔 값과 1:1 대응).
 */
const GROUP_STAT_ID: Record<string, string> = {
  한비광: "grp-hanbigwang",
  담화린: "grp-damhwarin",
  최상희: "grp-choesanghui",
  천마신군: "grp-cheonmasingun",
  진풍백: "grp-jinpungbaek",
}

/**
 * 그룹 대시보드 — 24시간 자동사냥 그룹(한비광그룹/천마신군그룹) 실시간 현황.
 *
 * "정보 표시" 중심 화면이다. 재접속은 버튼을 누르면 명령을 클립보드에
 * 복사해줄 뿐 직접 실행하지 않는다 — 사냥 중인 창을 잘못 건드리는 사고를
 * 코드 레벨에서 원천 차단한다.
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
 * 마력(정신력) 보유 직업 판별.
 *
 * ★"2_장군/2_대부/..." 폴더 기준이 여기엔 안 맞는다★
 *   그건 즐겨찾기 20명(2_장군/등 폴더에 흩어진 캐릭터)에 쓰던 규칙이다.
 *   이 대시보드의 그룹 캐릭터는 tin/한비광그룹/, tin/천마신군그룹/ 폴더
 *   하나에 다 모여 있어서 폴더로는 직업이 안 갈린다. 대신 이미 갖고 있는
 *   ROLE_OF 문자열 맨 앞 토큰("교황 · 정신력 회복" -> "교황")으로 직업을
 *   뽑는다 — 값 자체는 동일한 출처(1단계 조사 시 확인한 실제 직업)다.
 */
function jobClassOf(name: string): string {
  const role = ROLE_OF[name]
  if (!role) return ""
  return role.split(" · ")[0]
}

/** 교황·마왕만 마력을 쓴다(실측: 진풍백=장군·마력 0, 담화린=교황·마력 있음 등으로 확인). */
function hasMana(name: string): boolean {
  const job = jobClassOf(name)
  return job === "교황" || job === "마왕"
}

/**
 * 콤보 파일 경로 — 두 그룹 다 tin/{그룹명}/combo/{캐릭터명}.tin 형태로 실존한다
 * (1단계 조사에서 확인). config.py 의 GROUPS[...].dir 은 한비광그룹이 ""
 * 라서 여기 쓰기엔 신뢰할 수 없다 — 실제 폴더명은 그룹 표시명과 같다.
 *
 * /api/groups 의 direct_files 를 안 쓰는 이유도 같다 — 그 필드는 폴더 재편
 * 이전의 옛 파일명(FILE_TARGETS 키)을 그대로 돌려줘서 지금은 낡아있다.
 */
function comboPath(groupName: string, charName: string): string {
  return `tin/${groupName}/combo/${charName}.tin`
}

/**
 * 완전재접 명령 — tinadmin/docs/{그룹}.md 에 있던 수동 예시와 같은 형태다.
 * 세션/판/그룹/캐릭터 전부 실제 값(group.session, 실제 tmux 창번호, groupName,
 * name)에서 조합한다. 여기엔 실행 코드가 없다 — 문자열을 만들어 클립보드에
 * 복사할 뿐이다.
 */
function respawnCmd(session: string, groupName: string, name: string, pane: number): string {
  return `tmux respawn-pane -k -t ${session}:${pane} 'cd ~/projects/goblin && tt++ ${comboPath(groupName, name)}'`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Tauri 웹뷰에서 clipboard API 가 막히면 구형 경로로 시도한다
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.left = "-9999px"
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function CopyButton({ text, label, full }: { text: string; label: string; full?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          setTimeout(() => setDone(false), 1200)
          toast.success("복사됨", { description: text })
        } else {
          toast.error("복사하지 못했습니다")
        }
      }}
      className="cc-btn"
      style={full ? { width: "100%", justifyContent: "center" } : undefined}
      title={text}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? "복사됨" : label}
    </button>
  )
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoStr(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * live_windows 표시 순서 보정 — goblin:1 은 담화린, goblin:2 는 최상희다.
 *
 * ★왜 live_windows 만 고치는가★
 *   tmux 실제 창 순서(live_windows)는 1번=최상희, 2번=담화린으로 나와서
 *   자리가 바뀌어 있다. 반면 세션이 꺼졌을 때 쓰는 대체 순서(config.py
 *   GROUPS 순서)는 이미 담화린(1번)·최상희(2번)로 맞게 들어있으므로
 *   여기까지 건드리면 오히려 다시 틀어진다.
 *
 * API가 주는 배열 자체는 안 바꾸고, 1번·2번 "자리"에 앉는 이름만
 * 바꿔치기한다 — 이름이 바뀌면 comboPath/스탯 조회 등 나머지는 전부
 * 이름 기준이라 자동으로 맞게 따라온다.
 */
function fixLiveOrder(groupName: string, names: string[]): string[] {
  if (groupName !== "한비광그룹") return names
  const out = [...names]
  const i1 = out.indexOf("최상희")
  const i2 = out.indexOf("담화린")
  if (i1 !== -1 && i2 !== -1) {
    ;[out[i1], out[i2]] = [out[i2], out[i1]]
  }
  return out
}

/** 카드에 보여줄 순서 — 살아있으면 실제 tmux 창번호 순서, 죽어있으면 설정 순서(복병 제외). */
function orderedNames(g: GroupInfo): string[] {
  if (g.live && g.live_windows.length > 0) return fixLiveOrder(g.name, g.live_windows)
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
  // 하루/주/달 탭 전용 — 위 from/to(사용자가 바꾸는 범위)와 별개로 항상
  // 최근 30일을 받아둔다. 탭을 눌러도 다시 fetch 하지 않고 이 안에서
  // 이벤트 시각만 걸러 세 구간(1/7/30일)을 전부 계산한다.
  const [chars30, setChars30] = useState<CharStats[]>([])

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

  const loadStats30 = useCallback(async () => {
    try {
      const d = await getStatsMe(daysAgoStr(29), todayStr())
      setChars30(d.characters)
    } catch {
      // 탭 데이터는 부가 기능이다 — 실패해도 화면 전체가 죽으면 안 된다
    }
  }, [])

  useEffect(() => {
    void loadGroup()
  }, [loadGroup])
  useEffect(() => {
    void loadStats()
  }, [loadStats])
  useEffect(() => {
    void loadStats30()
  }, [loadStats30])

  const order = useMemo(() => (group ? orderedNames(group) : []), [group])
  const charByName = useMemo(() => {
    const m = new Map<string, CharStats>()
    for (const c of chars) m.set(c.name, c)
    return m
  }, [chars])
  const char30ByName = useMemo(() => {
    const m = new Map<string, CharStats>()
    for (const c of chars30) m.set(c.name, c)
    return m
  }, [chars30])
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

  // 그룹 전체 접속 복사 — order(실제 창번호 순서) 그대로 respawn-pane 을 이어붙인다
  const groupCopyText = group
    ? order.map((name, idx) => respawnCmd(group.session, groupName, name, idx)).join("; ")
    : ""

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

            <div className="ui-row" style={{ marginLeft: "auto", gap: 8, flexWrap: "wrap" }}>
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
                  void loadStats30()
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
              {group && order.length > 0 && (
                <CopyButton text={groupCopyText} label="그룹 전체 접속 복사" />
              )}
            </div>
          </div>
        </div>

        {/* 본문: 왼쪽 캐릭터 카드 + 오른쪽 그룹 합계 */}
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
                stat30={char30ByName.get(name)}
                hasStats={statCharNames.has(name)}
              />
            ))}
          </div>

          {/* 오른쪽 — 그룹 합계 */}
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
                  정신력 <b>+{totals.mp.toLocaleString()}</b>
                </span>
                <span>
                  이동력 <b>+{totals.mv.toLocaleString()}</b>
                </span>
              </div>
              <div className="ty-sub" style={{ marginTop: 8 }}>
                통계 대상 {trackedChars.length}명 · {from} ~ {to}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ETA 목표치 — 최종 확정판.
 *   체력   : 100만 하나, 전원 표시.
 *   정신력 : 10만 · 100만 두 목표를 나란히(교황·마왕만).
 *   이동력 : ETA 자체를 없앤다(요청 사항) — 최대 능력치 표시(MaxStatsRow)엔 그대로 남는다.
 */
const HP_GOAL = 1_000_000
const MP_GOALS = [100_000, 1_000_000] as const

/** 100000 -> "10만", 1000000 -> "100만" (라벨용) */
function manwon(v: number): string {
  return `${(v / 10_000).toLocaleString()}만`
}

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
 * 목표 도달 예상 — 카드에서 제일 눈에 띄어야 하는 값이라 별도 컴포넌트로 뺐다.
 *
 * 도달일 = (목표 - 현재 최대치) ÷ 1일평균.
 *   - current 를 모르면(favstats 캡처가 아직 없는 캐릭터거나 접속 전) 남은
 *     양을 목표 전체로 본다 — "0부터 시작"으로 보수적으로 잡는 것과 같다.
 *   - 남은 양이 0 이하(이미 목표를 넘었음)면 나눗셈 없이 "달성"만 보여준다.
 *   - 1일평균이 0 이하(이 기간에 안 오름)면 "측정 대기" — 무한대 방지.
 *
 * 마력(정신력)이 없는 직업(장군/대부)은 호출하는 쪽(CharCard)에서 아예
 * 렌더하지 않는다 — hasMana() 로 미리 걸러낸다.
 */
function GoalEta({
  label,
  goal,
  current,
  total,
  days,
  hue,
  minWidth,
}: {
  label: string
  goal: number
  current: number | null
  total: number
  days: number
  hue: number
  /** 정신력처럼 목표가 2개로 늘어나 한 줄에 다 못 들어갈 때, 줄바꿈되도록 최소폭을 준다. */
  minWidth?: number
}) {
  const rate = days > 0 ? total / days : 0
  const remaining = goal - (current ?? 0)
  const achieved = remaining <= 0

  return (
    <div className="cc-gauge" style={{ ["--ghue" as string]: hue, minWidth }}>
      <div className="ty-sub" style={{ letterSpacing: "1px" }}>
        {label} {manwon(goal)}까지
      </div>
      {achieved ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--ok)" }}>
          달성
        </div>
      ) : rate > 0 ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--cyan)",
            lineHeight: 1.3,
          }}
        >
          {formatEta(remaining / rate)}
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

const DAY_MS = 86_400_000

/** 하루/주/달 탭이 쓸 구간 합계 — 이미 받아둔 30일치 events 를 시각으로 잘라서 더한다. */
function sumEventsSince(events: LevelEvent[] | undefined, days: number) {
  const cutoff = Date.now() - days * DAY_MS
  const out = { hp: 0, mp: 0, mv: 0 }
  for (const e of events ?? []) {
    const t = new Date(e.at.replace(" ", "T")).getTime()
    if (Number.isFinite(t) && t >= cutoff) {
      out.hp += e.hp
      out.mp += e.mp
      out.mv += e.mv
    }
  }
  return out
}

type Period = "day" | "week" | "month"
const PERIOD_DAYS: Record<Period, number> = { day: 1, week: 7, month: 30 }
const PERIOD_LABEL: Record<Period, string> = { day: "하루", week: "주", month: "달" }

/** 기간별 상승 능력치 — [하루][주][달] 탭. 탭을 눌러도 새로 fetch 하지 않는다(이미 30일치를 들고 있다). */
function PeriodGrowth({ name, stat30 }: { name: string; stat30: CharStats | undefined }) {
  const [period, setPeriod] = useState<Period>("day")
  const growth = useMemo(
    () => sumEventsSince(stat30?.events, PERIOD_DAYS[period]),
    [stat30, period],
  )
  const mana = hasMana(name)

  return (
    <div>
      <div className="cc-tabs" style={{ marginBottom: 6 }}>
        {(["day", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`cc-tab${period === p ? " is-on" : ""}`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
      {!stat30 || stat30.pending ? (
        <div className="ty-sub">측정 대기</div>
      ) : (
        <div className="cc-stats">
          <span>
            체력 <b>+{growth.hp.toLocaleString()}</b>
          </span>
          {mana && (
            <span>
              정신력 <b>+{growth.mp.toLocaleString()}</b>
            </span>
          )}
          <span>
            이동력 <b>+{growth.mv.toLocaleString()}</b>
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * 최대 능력치 표시 — fav-command-center.tsx 의 MaxStats 와 같은 스타일.
 * 값 자체는 CharCard 가 fetch 해서 넘겨준다 — GoalEta 의 "현재 최대치"
 * 계산에도 같은 값을 써야 해서 여기서 따로 불러오지 않는다(중복 요청 방지).
 */
function MaxStatsRow({ stat, mana }: { stat: FavStat; mana: boolean }) {
  const fmt = (v: number | null) => (v === null ? "-" : v.toLocaleString())
  return (
    <div className="cc-stats" style={{ marginBottom: 6 }}>
      <span>
        최대 체력 <b>{fmt(stat.hpMax)}</b>
      </span>
      {mana && (
        <span>
          최대 정신력 <b>{fmt(stat.mpMax)}</b>
        </span>
      )}
      <span>
        최대 이동력 <b>{fmt(stat.mvMax)}</b>
      </span>
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
  stat30,
  hasStats,
}: {
  windowIndex: number
  session: string
  name: string
  groupName: string
  live: boolean
  stat: CharStats | undefined
  stat30: CharStats | undefined
  hasStats: boolean
}) {
  const pending = !stat || stat.pending
  const mana = hasMana(name)

  // 최대 능력치 — id 있는 5명만. GoalEta 의 "현재 최대치"에도 같은 값을 쓴다.
  const favId = GROUP_STAT_ID[name]
  const [maxStat, setMaxStat] = useState<FavStat>(EMPTY_STAT)
  useEffect(() => {
    if (!favId) return
    let alive = true
    void getFavStat(favId).then((s) => {
      if (alive) setMaxStat(s)
    })
    return () => {
      alive = false
    }
  }, [favId])

  return (
    <article className="cc-card">
      {/* 1. 이름 + 직업/역할 + 3. 접속 상태 점 */}
      <div className="cc-head">
        <span className={`cc-dot ${live ? "on" : "off"}`} title={live ? "접속 중" : "끊김"} />
        <span className="cc-name">{name}</span>
        <span className="cc-job">{ROLE_OF[name] ?? "-"}</span>
      </div>

      {/* 2. 세션:pane + 콤보 파일 */}
      <div className="cc-tags">
        <span className="cc-tag" style={{ fontFamily: "var(--font-mono)" }}>
          {session} {windowIndex}
        </span>
        <span className="cc-tag" style={{ fontFamily: "var(--font-mono)" }} title={comboPath(groupName, name)}>
          combo/{name}.tin
        </span>
      </div>

      {!hasStats ? (
        <div className="ty-sub" style={{ marginTop: 4, marginBottom: 10 }}>
          레벨업 통계 미연동 — 상태만 표시됩니다.
        </div>
      ) : pending ? (
        <div className="ty-sub" style={{ marginTop: 4, marginBottom: 10 }}>
          통계 연동됨 · 이 기간 기록 없음
        </div>
      ) : (
        <>
          {/* 최대 능력치 — 5명(한비광/담화린/최상희/천마신군/진풍백)만 캡처 자반이
              심겨 있다. id 없는 나머지 그룹 캐릭터는 이 줄 자체가 안 보인다. */}
          {favId && <MaxStatsRow stat={maxStat} mana={mana} />}

          {/* 4. 누적 성장(기간 증가량) — 최대치와는 다른 값이다. 즐겨찾기
              카드와 같은 cc-stats 스타일로, 위 날짜 범위 동안 실제로
              오른 총량을 보여준다. */}
          <div className="cc-stats" style={{ marginBottom: 10 }}>
            <span>
              체력 <b>+{stat.totals.hp.toLocaleString()}</b>
            </span>
            {mana && (
              <span>
                정신력 <b>+{stat.totals.mp.toLocaleString()}</b>
              </span>
            )}
            <span>
              이동력 <b>+{stat.totals.mv.toLocaleString()}</b>
            </span>
          </div>

          {/* 5. 기간별 상승 — 하루/주/달 탭 */}
          <div style={{ marginBottom: 10 }}>
            <PeriodGrowth name={name} stat30={stat30} />
          </div>

          {/* 6. 레벨업 평균 간격 — 서버가 이미 계산해 주는 값을 그대로 표기만 */}
          <div className="ty-sub" style={{ marginBottom: 10 }}>
            레벨업 주기: 평균 <b style={{ color: "var(--text)" }}>{fmt1(stat.gap_avg_min)}</b>분
          </div>

          {/* 7. 목표 도달 예상 — 체력 100만(전원) / 정신력 10만·100만(교황·마왕만).
              이동력 ETA 는 없앴다(요청 사항) — 이동력 최대치는 위 MaxStatsRow 에 그대로 있다. */}
          <div
            className="cc-gauges"
            style={{
              marginTop: 4,
              paddingTop: 10,
              borderTop: "1px solid var(--border-soft)",
              flexWrap: "wrap",
            }}
          >
            <GoalEta
              label="체력"
              goal={HP_GOAL}
              current={maxStat.hpMax}
              total={stat.totals.hp}
              days={elapsedDays(stat)}
              hue={150}
              minWidth={110}
            />
            {mana &&
              MP_GOALS.map((goal) => (
                <GoalEta
                  key={goal}
                  label="정신력"
                  goal={goal}
                  current={maxStat.mpMax}
                  total={stat.totals.mp}
                  days={elapsedDays(stat)}
                  hue={190}
                  minWidth={110}
                />
              ))}
          </div>
        </>
      )}

      {/* 개별 접속 복사 — 통계 연동 여부와 무관하게 항상 보여준다(재접속은 상태 표시와 별개 기능) */}
      <div style={{ marginTop: 10 }}>
        <CopyButton
          text={respawnCmd(session, groupName, name, windowIndex)}
          label="접속 복사"
          full
        />
      </div>
    </article>
  )
}
