import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Copy, Eye, Loader2, PlugZap, RefreshCw, Server } from "lucide-react"
import { toast } from "sonner"

import { getStatsMe, type CharStats, type LevelEvent } from "@/lib/api"
import { loadFavorites } from "@/lib/favorites"
import { getGroups, type GroupInfo } from "@/lib/groups"
import { EMPTY_STAT, getFavStat, type FavStat } from "@/lib/favstats"
import { getNote, saveNote } from "@/lib/notes-store"
import { copyText } from "@/lib/clipboard"
import { GroupCard, HOST_INTERNAL, RunButton } from "@/components/groups/group-card"
import { groupDefBySession } from "@/components/groups/group-defs"

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
 * 캐릭터 메모칸 key — 위 5명은 stat id 를 그대로 재사용(작업서 지시)하고,
 * 캡처 자반이 없는 나머지 5명도 메모는 필요해서 같은 "grp-" 규칙으로
 * 새 key 를 만들어 채웠다. tin 파일과는 무관한 순수 저장용 키라 로마자
 * 표기가 완벽하지 않아도 상관없다 — 화면에 노출되지 않는다.
 */
const NOTE_KEY: Record<string, string> = {
  ...GROUP_STAT_ID,
  초운현: "grp-chounhyeon",
  커: "grp-keo",
  매유진: "grp-maeyujin",
  벽력자: "grp-byeokryeokja",
  천운악: "grp-cheonunak",
}

/** 그룹 전체 메모칸 key — 작업서 예시(grp-hanbigwang-group)를 두 그룹에 일반화했다. */
const GROUP_SLUG: Record<string, string> = {
  한비광그룹: "hanbigwang",
  천마신군그룹: "cheonmasingun",
  // 직업그룹 4개(2026-08-22 추가) — 메모 key 는 [a-zA-Z0-9_-] 만 허용하므로
  // 한글 그룹명을 그대로 쓸 수 없다. 세션명을 슬러그로 재사용한다.
  장군: "janggun",
  대부: "daebu",
  교황: "gyohwang",
  마왕: "mawang",
}

/**
 * 직업그룹 4개 — 리더 2그룹과 파일 배치·카드 구성이 다르다.
 *
 * | 항목 | 리더 2그룹 | 직업그룹 4개 |
 * |---|---|---|
 * | 조합 파일 | `{그룹}/combo/{이름}.tin` | `_combos/{이름}.tin` |
 * | 원본 tin | `{그룹}/{이름}.tin` (천마는 접두사) | `2_{그룹}/{이름}.tin` |
 * | 카드 | 레벨업 통계(stats.log) | 즐겨찾기 최대능력치(체력/마력/이동) |
 *
 * 20명 전부 combo 가 실제로 #read 하는 대상과 대조해 확인했다(2026-08-22).
 */
const JOB_GROUPS = new Set(["장군", "대부", "교황", "마왕"])

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
  // 직업그룹 4개는 그룹 폴더가 없고 조합이 전부 tin/_combos/ 한곳에 모여 있다.
  if (JOB_GROUPS.has(groupName)) return `tin/_combos/${charName}.tin`
  return `tin/${groupName}/combo/${charName}.tin`
}

/**
 * 완전재접 명령 — tinadmin/docs/{그룹}.md 에 있던 수동 예시와 같은 형태다.
 * 세션/판/그룹/캐릭터 전부 실제 값(group.session, 실제 tmux 창번호, groupName,
 * name)에서 조합한다. 여기엔 실행 코드가 없다 — 문자열을 만들어 클립보드에
 * 복사할 뿐이다.
 */
/**
 * combo 를 거치지 않고 tin 하나로 완결되는 캐릭터.
 *
 * ★졸일이 유일한 예외다★ 쫄 자동순환 캐릭터라 그룹기본을 얹을 게 없어
 *   combo/졸일.tin 이 아예 없다. 2026-08-21 에 쫄그룹(jjol1 단독 세션)에서
 *   한비광그룹(goblin)으로 편입하면서 이 그룹에 combo 없는 캐릭터가 처음 생겼다.
 *   여기 안 넣으면 [접속] 이 없는 파일을 실행해 그 창이 조용히 죽는다.
 *   `start_tmux.sh` 의 졸일 줄과 같은 경로여야 한다.
 */
const NO_COMBO = new Set(["졸일"])

/** tt++ 가 실제로 실행할 파일 — combo 가 있으면 combo, 없으면 원본 직결. */
function launchPath(groupName: string, name: string): string {
  return NO_COMBO.has(name) ? `tin/${sourceTinRel(groupName, name)}` : comboPath(groupName, name)
}

function respawnCmd(session: string, groupName: string, name: string, pane: number): string {
  return `tmux respawn-pane -k -t ${session}:${pane} 'cd ~/projects/goblin && tt++ ${launchPath(groupName, name)}'`
}

/**
 * 캐릭터의 "원본" tin 파일 경로 (tin/ 아래 상대경로).
 *
 * ★규칙 하나로 안 된다★ 한비광그룹은 {그룹}/{캐릭터}.tin 로 딱 맞지만,
 *   천마신군그룹은 직업 접두사가 붙어 있다(대부_천마신군.tin 처럼).
 *   그래서 접두사가 붙는 쪽만 표로 적어두고 나머지는 규칙을 쓴다.
 *   combo 가 있는 9명은 전부 combo 파일이 실제로 #read 하는 대상과 대조해
 *   확인했다(2026-08-21). 졸일은 combo 가 없고 규칙(`한비광그룹/졸일.tin`)이
 *   그대로 맞으므로 표에 넣지 않는다 — 실행 경로는 NO_COMBO 가 가른다.
 *
 *   /api/groups 의 direct_files 를 안 쓰는 이유는 comboPath 와 같다 — 한비광그룹은
 *   FILE_TARGETS 에 등록이 없어 빈 배열이 온다.
 */
const SOURCE_TIN: Record<string, string> = {
  천마신군: "천마신군그룹/대부_천마신군.tin",
  진풍백: "천마신군그룹/장군_진풍백.tin",
  매유진: "천마신군그룹/마왕_매유진.tin",
  벽력자: "천마신군그룹/교황_벽력자.tin",
  천운악: "천마신군그룹/교황_천운악.tin",
}

/** 파일관리 화면이 쓰는 경로(tin/ 접두사 없음). */
function sourceTinRel(groupName: string, name: string): string {
  // 직업그룹 4개는 원본이 2_{그룹}/ 아래에 있다 (2_장군/담신우.tin 처럼).
  if (JOB_GROUPS.has(groupName)) return `2_${groupName}/${name}.tin`
  return SOURCE_TIN[name] ?? `${groupName}/${name}.tin`
}

/**
 * 캐릭터 한 명만 다시 띄우고 그 창을 붙잡는 명령.
 *
 * ★-k 는 대상 창을 죽인다 — 창번호가 곧 안전장치다★ 여기 들어오는 pane 은
 *   paneIndexMap 이 서버(tmux list-windows)에서 그대로 받아온 값이라야 한다.
 *   배열 위치로 추측한 값을 넣으면 엉뚱한 캐릭터가 끊긴다.
 *
 * attach 에 창까지 지정해 붙으면 그 캐릭터 화면이 바로 뜬다.
 * (홑따옴표만 쓴다 — check_remote 가 겹따옴표를 막는다.)
 */
function connectCharCmd(session: string, groupName: string, name: string, pane: number): string {
  return (
    `${respawnCmd(session, groupName, name, pane)}; ` +
    `tmux select-window -t ${session}:${pane}; ` +
    `tmux attach -t ${session}:${pane}`
  )
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

/**
 * 한방 접속 복사칸 — 읽기전용 textarea + 복사 버튼.
 * 카드 개별 복사(CopyButton)와 별개 UI다: 저 버튼은 라벨만 바뀌는 단순
 * 버튼이고, 여긴 실행할 명령을 눈으로 확인할 수 있게 통째로 보여준다.
 *
 * ★이 명령은 그룹을 통째로 재시작한다★ 시작 스크립트를 부르는 한 줄이라,
 *   붙여넣어 실행하면 그 세션이 끊겼다가 스크립트에 적힌 구성으로 다시 뜬다.
 *   카드 개별 "완전재접"(그 캐릭터 한 명만 되살림)과는 영향 범위가 다르다.
 */
/**
 * 자반 중지/실행 복사 카드 6개 — #ignore 명령을 클립보드에 복사만 한다.
 *
 * ★서버 호출 없음★ 세션·그룹으로 명령을 조립하는 게 아니라
 *   고정 문자열을 그대로 복사만 하므로 group/session 정보가 전혀 필요 없다
 *   — 그래서 두 그룹(한비광그룹/천마신군그룹) 어디서 렌더해도 항상 같은
 *   6개가 뜬다. copyText/toast 피드백은 CopyButton과 동일하게 재사용한다.
 */
const IGNORE_CARDS: { label: string; cmd: string }[] = [
  { label: "액션 끄기", cmd: "#ignore actions on" },
  { label: "액션 켜기", cmd: "#ignore actions off" },
  { label: "줄임말 끄기", cmd: "#ignore aliases on" },
  { label: "줄임말 켜기", cmd: "#ignore aliases off" },
  { label: "틱커 끄기", cmd: "#ignore tickers on" },
  { label: "틱커 켜기", cmd: "#ignore tickers off" },
]

function IgnoreCard({ label, cmd }: { label: string; cmd: string }) {
  const [done, setDone] = useState(false)
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 6px 4px 10px",
        borderRadius: 2,
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 11.5, color: "#fff", whiteSpace: "nowrap" }}>{label}</span>
      <button
        onClick={async () => {
          if (await copyText(cmd)) {
            setDone(true)
            setTimeout(() => setDone(false), 1200)
            toast.success("복사됨", { description: cmd })
          } else {
            toast.error("복사하지 못했습니다")
          }
        }}
        className="cc-btn"
        style={{ padding: "3px 8px", fontSize: 10.5 }}
        title={cmd}
      >
        {done ? <Check className="size-3" /> : <Copy className="size-3" />}
        {done ? "복사됨" : "복사"}
      </button>
    </div>
  )
}

/** 한방 접속 복사칸 바로 아래에 붙는 작은 섹션 — 6개 카드를 한 줄에 나란히, 좁아지면 자동 줄바꿈. */
function IgnoreControlsSection() {
  return (
    <div className="cc-panel">
      <div className="cc-panel-title" style={{ marginBottom: 8 }}>
        자반 중지/실행
      </div>
      <div className="ty-sub" style={{ marginBottom: 10 }}>
        멈추려는 캐릭터 창 하나에 붙여넣기 (붙여넣은 그 창만 적용됨). 액션·줄임말·틱커를 잠시 멈추거나 다시 켠다.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {IGNORE_CARDS.map((c) => (
          <IgnoreCard key={c.label} label={c.label} cmd={c.cmd} />
        ))}
      </div>
    </div>
  )
}

/**
 * 개인/그룹 메모칸 — 마운트 시 GET, 포커스를 벗어나면(onBlur) POST 로 저장한다.
 * 실패해도 화면이 죽지 않는다(notes-store 의 get/saveNote 는 절대 안 던짐).
 */
function NoteBox({ noteKey, placeholder }: { noteKey: string; placeholder: string }) {
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void getNote(noteKey).then((v) => {
      if (alive) setValue(v)
    })
    return () => {
      alive = false
    }
  }, [noteKey])

  async function handleBlur() {
    setSaving(true)
    const ok = await saveNote(noteKey, value)
    setSaving(false)
    if (!ok) toast.error("메모 저장 실패", { description: noteKey })
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void handleBlur()}
        placeholder={placeholder}
        rows={2}
        style={{
          width: "100%",
          resize: "vertical",
          fontSize: 12,
          lineHeight: 1.5,
          padding: 8,
          borderRadius: 2,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
        }}
      />
      {saving && (
        <Loader2
          className="size-3 animate-spin"
          style={{ position: "absolute", right: 8, top: 8, color: "var(--text-dim)" }}
        />
      )}
    </div>
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
 * 세션이 꺼져 있을 때 쓰는 대체 순서 — config.py GROUPS 등록 순서.
 *
 * 예전에는 여기서 "복병"을 걸러냈다. 한비광그룹에 등록돼 있는데 실제로는
 * daebu 세션에서 뜨는 캐릭터였기 때문이다. 2026-08-22 에 config.py 를
 * 실측대로 고쳐(복병을 대부 windows 의 1번 자리로 옮김) 더 이상 걸러낼
 * 이름이 없다 — 이제 등록 순서가 곧 실제 창번호 순서다.
 */
function configOrder(g: GroupInfo): string[] {
  return g.windows
}

/** 카드에 보여줄 순서 — 살아있으면 실제 tmux 창 순서, 죽어있으면 설정 순서. */
function orderedNames(g: GroupInfo): string[] {
  if (g.live && g.live_windows.length > 0) return g.live_windows.map((w) => w.name)
  return configOrder(g)
}

/**
 * 캐릭터 이름 → 실제 tmux 창번호.
 *
 * ★여기가 접속·완전재접 명령의 안전장치다★
 *   respawn-pane 은 -k 로 대상 창을 죽인다. 창번호가 한 칸이라도 어긋나면
 *   엉뚱한 캐릭터가 끊긴다. 그래서 세션이 살아있는 동안에는 서버가 tmux 에서
 *   직접 읽어온 index 를 그대로 쓰고, 배열 위치로 추측하지 않는다.
 *
 *   (예전에는 위치로 추측한 데다 한비광그룹만 최상희↔담화린 자리를 바꿔치기해서,
 *    담화린 카드의 명령이 실제로는 최상희 창을 죽이고 있었다. 2026-08-21 수정.)
 *
 *   세션이 꺼져 있으면 tmux 에 물어볼 대상이 없다. 이때만 설정 순서의 위치를
 *   쓰는데, 어차피 창이 없어 respawn 이 성립하지 않으므로 시작 스크립트로
 *   세션을 먼저 띄우는 게 정상 경로다.
 */
function paneIndexMap(g: GroupInfo): Map<string, number> {
  const m = new Map<string, number>()
  if (g.live && g.live_windows.length > 0) {
    for (const w of g.live_windows) m.set(w.name, w.index)
    return m
  }
  configOrder(g).forEach((n, i) => m.set(n, i))
  return m
}

/**
 * 천마신군그룹 카드 "화면 표시" 순서 — 요청된 고정 순서.
 *
 * ★창번호(windowIndex)는 안 건드린다★
 *   여기서 만드는 배열은 카드가 화면에 그려지는 "순서"만 바꾼다. 실제 창번호는
 *   paneIndexMap(서버가 tmux 에서 읽어온 index)이 이름으로 따로 주므로,
 *   표시 순서를 아무리 바꿔도 접속 명령은 틀어지지 않는다.
 */
const CHUNMA_DISPLAY_ORDER = ["천마신군", "진풍백", "매유진", "벽력자", "천운악"]

/** 한비광그룹은 기존 순서(order) 그대로, 천마신군그룹만 위 고정 순서로 재배열한다. */
function displayOrder(groupName: string, names: string[]): string[] {
  if (groupName !== "천마신군그룹") return names
  const rank = new Map(CHUNMA_DISPLAY_ORDER.map((n, i) => [n, i]))
  return [...names].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99))
}

export function GroupDashboard({
  groupName,
  onOpenFile,
}: {
  groupName: string
  onOpenFile: (name: string) => void
}) {
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
  // 이름 → 실제 tmux 창번호. 카드의 접속/완전재접 명령이 이 값만 쓴다.
  const paneByName = useMemo(
    () => (group ? paneIndexMap(group) : new Map<string, number>()),
    [group],
  )
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

  // 통계가 붙은(has_stats) 캐릭터만 — CharCard 에 hasStats 로 넘긴다.
  const statCharNames = new Set(
    (group?.characters ?? []).filter((c) => c.has_stats).map((c) => c.name),
  )

  // 그룹 전체 동작 카드(GroupCard)에 넘길 정의. 시작 스크립트 이름 같은 건
  // group-card.tsx 의 startScriptOf 가 알아서 고른다.
  // 즐겨찾기 이름 → id. 직업그룹 카드가 최대능력치·메모 key 로 쓴다.
  // 이름을 하드코딩하지 않으려고 서버 목록에서 그때그때 만든다.
  const [favIdByName, setFavIdByName] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    if (!JOB_GROUPS.has(groupName)) return
    let alive = true
    void loadFavorites()
      .then(({ store }) => {
        if (!alive) return
        const m = new Map<string, string>()
        for (const it of store.items) if (it.name) m.set(it.name, it.id)
        setFavIdByName(m)
      })
      .catch(() => {
        /* 즐겨찾기를 못 읽어도 카드는 떠야 한다 — 스탯칸만 "-" 로 남는다 */
      })
    return () => {
      alive = false
    }
  }, [groupName])

  const groupDef = group ? groupDefBySession(group.session) : undefined

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
            </div>
          </div>
        </div>

        {/* 그룹 전체 동작 — 메인페이지와 똑같은 카드를 그대로 쓴다.
            (예전에는 시작 스크립트 한 줄을 복사만 하는 칸이었다. 메인페이지에서
             이미 되던 접속/끊기/뷰를 여기서도 바로 누를 수 있게 카드로 바꿨다.) */}
        {group && order.length > 0 && groupDef && (
          <GroupCard
            group={groupDef}
            onOpenFile={onOpenFile}
            // 직업그룹 4개만 파일 줄을 가로 한 줄로. 메인페이지는 기본값(stack)이라
            // 이 prop 을 넘기지 않으므로 렌더 결과가 바뀌지 않는다.
            filesLayout={JOB_GROUPS.has(groupName) ? "row" : "stack"}
          />
        )}

        {/* 자반 중지/실행 복사 카드 6개 — 한방 접속 복사칸 바로 아래, 그룹 무관 고정 */}
        <IgnoreControlsSection />

        {/* 그룹 전체 메모칸 — 카드들 위 최상단 */}
        <NoteBox
          noteKey={GROUP_SLUG[groupName] ? `grp-${GROUP_SLUG[groupName]}-group` : `grp-${groupName}-group`}
          placeholder="그룹 메모"
        />

        {/* 캐릭터 카드 2열 배치 (화면 표시 순서 — 천마신군그룹만 고정 순서, 창번호는
            paneByName 이 서버 index 로 따로 준다), 1000px 이하에서 1열로 전환 */}
        <div className="cc-card-grid">
          {order.length === 0 && !groupLoading && (
            <div className="cc-panel ty-sub">그룹 정보를 불러오지 못했습니다.</div>
          )}
          {displayOrder(groupName, order).map((name) =>
            JOB_GROUPS.has(groupName) ? (
              <JobCharCard
                key={name}
                windowIndex={paneByName.get(name) ?? order.indexOf(name)}
                session={group?.session ?? ""}
                name={name}
                groupName={groupName}
                live={liveByName.get(name) ?? false}
                favId={favIdByName.get(name)}
                onOpenFile={onOpenFile}
              />
            ) : (
              <CharCard
                key={name}
                windowIndex={paneByName.get(name) ?? order.indexOf(name)}
                session={group?.session ?? ""}
                name={name}
                groupName={groupName}
                live={liveByName.get(name) ?? false}
                stat={charByName.get(name)}
                stat30={char30ByName.get(name)}
                hasStats={statCharNames.has(name)}
                onOpenFile={onOpenFile}
              />
            ),
          )}
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
 *
 * 최대 정신력은 mana(교황/마왕) 여부와 무관하게 항상 보여준다(대부/장군도
 * favstats 값 자체는 있다) — ETA(GoalEta)만 교황·마왕으로 계속 제한한다.
 * 글씨는 라벨/숫자 다 한 단계 크게(13px, 기본 .cc-stats 12px보다 큼).
 */
function MaxStatsRow({ stat }: { stat: FavStat }) {
  const fmt = (v: number | null) => (v === null ? "-" : v.toLocaleString())
  return (
    <div className="cc-stats" style={{ marginBottom: 6, fontSize: 13 }}>
      <span>
        최대 체력 <b>{fmt(stat.hpMax)}</b>
      </span>
      <span>
        최대 정신력 <b>{fmt(stat.mpMax)}</b>
      </span>
      <span>
        최대 이동력 <b>{fmt(stat.mvMax)}</b>
      </span>
    </div>
  )
}

/**
 * 직업그룹 캐릭터 카드 — 즐겨찾기(FavCommandCenter) 카드와 같은 모양.
 *
 * ★리더 2그룹과 왜 다른 카드인가★
 *   한비광·천마신군 캐릭터는 tin 자반이 레벨업을 stats.log 에 찍어줘서
 *   "며칠간 몇 번 올랐나" 를 보여줄 수 있다. 직업그룹 20명에는 그 자반이 없다.
 *   대신 20명 전원이 즐겨찾기에 등록돼 있어 최대능력치(체력/마력/이동)를
 *   `/api/favstats/{id}` 로 받을 수 있다 — 그래서 그쪽 모양을 따른다.
 *
 * ★메모칸이 없다★ 리더 2그룹 카드에는 있지만 이 카드에는 일부러 두지 않았다
 *   (2026-08-22). 카드를 작게 유지하는 게 목적이고, 메모가 필요하면 즐겨찾기
 *   화면에서 같은 캐릭터에 달 수 있다. 다른 화면의 메모 기능은 그대로다.
 */
function JobCharCard({
  windowIndex,
  session,
  name,
  groupName,
  live,
  favId,
  onOpenFile,
}: {
  /** 실제 tmux 창번호 — paneIndexMap 이 서버 index 에서 준 값 */
  windowIndex: number
  session: string
  name: string
  groupName: string
  live: boolean
  /** 즐겨찾기 id. 없으면 스탯·메모칸을 숨긴다(등록 안 된 캐릭터). */
  favId: string | undefined
  onOpenFile: (name: string) => void
}) {
  const [stat, setStat] = useState<FavStat>(EMPTY_STAT)

  useEffect(() => {
    if (!favId) return
    let alive = true
    void getFavStat(favId).then((v) => {
      if (alive) setStat(v)
    })
    return () => {
      alive = false
    }
  }, [favId])

  const fmt = (v: number | null) => (v === null ? "-" : v.toLocaleString())
  const rel = sourceTinRel(groupName, name)

  return (
    <article className="cc-card">
      <div className="cc-head">
        <span className={live ? "cc-dot on" : "cc-dot"} />
        <span className="cc-name">{name}</span>
        <span className="cc-job">{groupName}</span>
      </div>

      {/* 최대 능력치 — 게임에서 "점수"를 쳐야 값이 생긴다. 없으면 "-" */}
      <div className="cc-stats" style={{ marginBottom: 0 }}>
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

      {/* 창번호는 서버가 tmux 에서 읽어온 실제 값이다 */}
      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
        <RunButton
          label="접속"
          icon={<PlugZap className="size-3.5" />}
          group={name}
          target={HOST_INTERNAL}
          remote={connectCharCmd(session, groupName, name, windowIndex)}
          needConfirm
          confirmText={
            `[${name}] 접속\n\n` +
            `${session}:${windowIndex} 창만 끊고 다시 띄웁니다.\n` +
            `같은 그룹의 다른 캐릭터는 건드리지 않습니다.\n\n계속할까요?`
          }
        />
        <button
          onClick={() => onOpenFile(rel)}
          className="cc-btn"
          title={`tin/${rel}`}
        >
          <Eye className="size-3.5" />
          파일보기
        </button>
      </div>
    </article>
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
  onOpenFile,
}: {
  /** 실제 tmux 창번호 — paneIndexMap 이 서버 index 에서 준 값 */
  windowIndex: number
  session: string
  name: string
  groupName: string
  live: boolean
  stat: CharStats | undefined
  stat30: CharStats | undefined
  hasStats: boolean
  onOpenFile: (name: string) => void
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
          {favId && <MaxStatsRow stat={maxStat} />}

          {/* 4. 누적 성장(기간 증가량) — 최대치와는 다른 값이다. 즐겨찾기
              카드와 같은 cc-stats 스타일로, 위 날짜 범위 동안 실제로
              오른 총량을 보여준다. */}
          <div className="cc-stats" style={{ marginBottom: 10 }}>
            <span>
              체력 <b>+{stat.totals.hp.toLocaleString()}</b>
            </span>
            <span>
              정신력 <b>+{stat.totals.mp.toLocaleString()}</b>
            </span>
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

      {/* 개별 동작 — 통계 연동 여부와 무관하게 항상 보여준다(재접속은 상태 표시와 별개 기능).
          창번호(windowIndex)는 서버가 tmux 에서 읽어온 실제 값이다. */}
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
        <RunButton
          label="접속"
          icon={<PlugZap className="size-3.5" />}
          group={name}
          target={HOST_INTERNAL}
          remote={connectCharCmd(session, groupName, name, windowIndex)}
          needConfirm
          confirmText={
            `[${name}] 접속\n\n` +
            `${session}:${windowIndex} 창만 끊고 다시 띄웁니다.\n` +
            `같은 그룹의 다른 캐릭터는 건드리지 않습니다.\n\n계속할까요?`
          }
        />
        <button
          // 파일관리가 쓰는 경로는 "tin/" 접두사가 없다(group-card.tsx 와 같은 규칙).
          onClick={() => onOpenFile(sourceTinRel(groupName, name))}
          className="cc-btn"
          title={`tin/${sourceTinRel(groupName, name)}`}
        >
          <Eye className="size-3.5" />
          파일보기
        </button>
      </div>

      {/* 손으로 붙여넣을 때 쓰는 완전재접 한 줄 */}
      <div style={{ marginTop: 6 }}>
        <CopyButton
          text={respawnCmd(session, groupName, name, windowIndex)}
          label="접속 복사"
          full
        />
      </div>

      {/* 개인 메모칸 */}
      <div style={{ marginTop: 8 }}>
        <NoteBox noteKey={NOTE_KEY[name] ?? `grp-${name}`} placeholder="메모" />
      </div>
    </article>
  )
}
