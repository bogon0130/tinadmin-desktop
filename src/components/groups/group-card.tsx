import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Check, Copy, Eye, Loader2, Monitor, PlugZap, Unplug } from "lucide-react"
import { toast } from "sonner"

import { copyText } from "@/lib/clipboard"

/**
 * 그룹 카드 한 장을 그리는 공용 부품.
 *
 * ★메인페이지와 쫄그룹 화면이 같은 카드를 쓴다★ 원래는 main-view.tsx 안에만
 *   있었는데, 쫄 6장을 전용 화면으로 옮기면서 두 화면이 같은 카드를 필요로 하게
 *   됐다. 복사해 두 벌을 두면 한쪽만 고쳐지는 사고가 나므로 여기로 뺐다.
 *
 * ★이 카드는 실제로 서버에 명령을 실행한다★
 *   접속은 원래 서버(/api/combo/connect)가 만들어 준 명령만 실행했는데, 여기서
 *   쓰는 명령(시작 스크립트 실행 / kill-session / attach)은 그 API 가 만들어 주지
 *   않는 형태라 프론트에서 직접 조립해 open_terminal 로 넘긴다. 조립에 들어가는
 *   값은 호출부가 넘기는 고정 문자열뿐이고 사용자 입력이 섞이지 않으므로,
 *   화면에서 임의 명령이 만들어질 여지는 없다.
 *   (Rust 쪽 check_remote 가 겹따옴표·제어문자·1000자 초과를 추가로 막는다.)
 */
/** ssh 접속 대상 — 집 LAN 에서 쓰는 내부 주소 */
export const HOST_INTERNAL = "kimbogon@192.168.219.157"
/** ssh 접속 대상 — 밖에서 쓰는 Cloudflare 터널 주소 */
export const HOST_EXTERNAL = "kimbogon@ssh.bogon.kr"

/** 카드에 줄로 뿌릴 tin 파일 하나 */
export type TinFile = { label: string; path: string }

/** 그룹 카드 하나 */
export type GroupDef = {
  name: string
  session: string
  files: TinFile[]
  /** 세션명에서 유추되는 이름과 다른 경우에만 적는다(startScriptOf 참고). */
  startScript?: string
  /**
   * 세션 안에 캐릭터가 한 명뿐인가(쫄 6개가 여기 해당).
   * 확인창 문구를 "그 그룹 전원" / "이 캐릭터만" 으로 가르는 데만 쓴다.
   * 파일 줄 수 같은 걸로 추론하면 나중에 줄이 늘 때 조용히 틀어지므로 명시한다.
   */
  solo?: boolean
}

/**
 * 그룹을 띄우는 시작 스크립트 이름.
 *
 * ★규칙에서 벗어나는 게 둘 있다★
 *   - goblin : start_goblin.sh 가 아니라 start_tmux.sh 가 만든다(실측 2026-08-14).
 *   - 쫄 6캐릭: 세션은 jjol1~jjol6 으로 여섯인데 스크립트는 start_jjol.sh 하나가
 *     여섯을 전부 만든다. 그래서 세션명으로 유추할 수 없고 GROUPS 에서 직접 준다.
 *   그 외에는 start_{세션명}.sh 규칙 그대로다.
 */
export function startScriptOf(group: GroupDef): string {
  if (group.startScript) return group.startScript
  return group.session === "goblin" ? "start_tmux.sh" : `start_${group.session}.sh`
}

/**
 * "접속" 이 실행할 원격 명령.
 *
 * ★먼저 kill-session 을 한 뒤 시작 스크립트를 부른다★ 스크립트마다 기존 세션을
 *   다루는 방식이 달라서다 — start_tmux.sh / start_chunma.sh 는 자기가 알아서
 *   kill 하지만, 직업그룹 4개(janggun/daebu/gyohwang/mawang)는 has-session 가드가
 *   있어 세션이 이미 떠 있으면 경고만 찍고 아무것도 안 한다. 앞에 kill 을 붙여야
 *   6개 그룹이 "누르면 재시작" 으로 똑같이 동작한다.
 *   2>/dev/null 은 세션이 없을 때 나오는 에러를 삼키기 위한 것이고, 세미콜론이라
 *   kill 이 실패해도 스크립트는 그대로 실행된다.
 *
 * ★마지막에 attach 를 이어붙인다★ 스크립트는 세션을 백그라운드(-d)로 띄우고 끝나서,
 *   예전에는 그 자리에 빈 PowerShell 창만 덩그러니 남았다. attach 를 붙이면 같은
 *   창이 그대로 tmux 화면으로 바뀌어 "접속하면 바로 보인다".
 *   세미콜론은 check_remote 가 막지 않는다(겹따옴표·제어문자만 차단).
 */
export function connectCmd(group: GroupDef): string {
  const s = group.session
  return (
    `tmux kill-session -t ${s} 2>/dev/null; ` +
    `bash ~/projects/goblin/${startScriptOf(group)}; ` +
    `tmux attach -t ${s}`
  )
}

/**
 * #read 한 줄을 클립보드에 넣는 버튼.
 * 성공하면 1.2초 동안 라벨이 "복사됨" 으로 바뀐다(group-dashboard 와 같은 방식).
 */
function ReadCopyButton({ path }: { path: string }) {
  const [done, setDone] = useState(false)
  const text = `#read ${path}`

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
      title={text}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? "복사됨" : "#read 복사"}
    </button>
  )
}

/**
 * 새 터미널 창을 띄워 원격 명령을 실행하는 버튼.
 *
 * ★title 에 겹따옴표를 넣으면 안 된다★ Rust 쪽에서 명령줄을 겹따옴표로 감싸므로
 *   safe_title 이 걸러내긴 하지만, 애초에 안 만드는 게 맞다(한글·— 는 안전).
 *
 * needConfirm 이 켜진 버튼(접속/끊기)은 사냥 중인 세션을 끊으므로 확인을 먼저 받는다.
 * 뷰(attach)는 보기만 하는 것이라 확인 없이 바로 연다.
 */
export function RunButton({
  label,
  icon,
  group,
  target,
  remote,
  needConfirm,
  confirmText,
  keepOpen = true,
}: {
  label: string
  icon: React.ReactNode
  group: string
  target: string
  remote: string
  needConfirm?: boolean
  confirmText?: string
  /** 명령이 끝난 뒤 터미널 창을 남길지. 기본은 남긴다(실패 이유를 봐야 하므로). */
  keepOpen?: boolean
}) {
  const [busy, setBusy] = useState(false)

  return (
    <button
      onClick={async () => {
        if (needConfirm && !window.confirm(confirmText ?? `[${group}] ${label} — 정말 하시겠습니까?`)) {
          return
        }
        setBusy(true)
        try {
          const ran = await invoke<string>("open_terminal", {
            target,
            remote,
            title: `${group} ${label} — tinadmin`,
            keep_open: keepOpen,
          })
          console.info("[main] 실행:", ran)
          toast.success(`🖥️ ${group} · ${label}`, { description: remote })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          toast.error(`${group} · ${label} 실패`, { description: msg })
        } finally {
          setBusy(false)
        }
      }}
      disabled={busy}
      className="cc-btn"
      title={`${target} → ${remote}`}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {label}
    </button>
  )
}

export function GroupCard({
  group,
  onOpenFile,
}: {
  group: GroupDef
  onOpenFile: (name: string) => void
}) {
  const s = group.session
  const connect = connectCmd(group)
  // 접속은 세션을 통째로 끊고 다시 띄우므로, 무엇이 일어나는지 확인창에 그대로 적는다.
  // ★쫄은 세션에 캐릭터가 한 명뿐이라 영향 범위가 좁다★ 나머지 그룹은 세션 하나에
  //   여러 명이 들어 있어 "그 그룹 전원" 이 끊기므로, 문구를 그에 맞게 나눈다.
  //   (2026-08-15 시작 스크립트를 캐릭별로 쪼개기 전에는 쫄도 6명이 함께 끊겼다)
  const isSolo = group.solo === true
  const connectConfirm = isSolo
    ? `[${group.name}] 접속\n\n` +
      `${s}(${group.name})만 끊고 다시 띄웁니다.\n` +
      `다른 쫄은 건드리지 않습니다.\n\n계속할까요?`
    : `[${group.name}] 접속\n\n` +
      `${s} 세션을 끊고 다시 띄웁니다.\n` +
      `사냥 중이면 그 그룹 전원이 즉시 끊깁니다.\n\n계속할까요?`
  const killConfirm = isSolo
    ? `[${group.name}] 끊기\n\n` +
      `${s}(${group.name}) 세션을 종료합니다.\n` +
      `다른 쫄은 건드리지 않습니다.\n\n계속할까요?`
    : `[${group.name}] 끊기\n\n` +
      `${s} 세션을 종료합니다.\n` +
      `그 그룹 전원이 즉시 끊깁니다.\n\n계속할까요?`

  return (
    <article className="cc-card">
      <div className="cc-head">
        <span className="cc-name">{group.name}</span>
        <span className="ty-sub" style={{ marginLeft: "auto" }}>
          {s}
        </span>
      </div>

      {/* 그룹 동작 버튼 줄 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <RunButton
          label="접속(내부)"
          icon={<PlugZap className="size-3.5" />}
          group={group.name}
          target={HOST_INTERNAL}
          remote={connect}
          needConfirm
          confirmText={connectConfirm}
        />
        <RunButton
          label="접속(외부)"
          icon={<PlugZap className="size-3.5" />}
          group={group.name}
          target={HOST_EXTERNAL}
          remote={connect}
          needConfirm
          confirmText={connectConfirm}
        />
        <RunButton
          label="끊기"
          icon={<Unplug className="size-3.5" />}
          group={group.name}
          target={HOST_INTERNAL}
          remote={`tmux kill-session -t ${s}`}
          needConfirm
          confirmText={killConfirm}
          // 순식간에 끝나고 볼 결과도 없으므로 창을 남기지 않는다.
          keepOpen={false}
        />
        <RunButton
          label="뷰(내부)"
          icon={<Monitor className="size-3.5" />}
          group={group.name}
          target={HOST_INTERNAL}
          remote={`tmux attach -t ${s}`}
        />
        <RunButton
          label="뷰(외부)"
          icon={<Monitor className="size-3.5" />}
          group={group.name}
          target={HOST_EXTERNAL}
          remote={`tmux attach -t ${s}`}
        />
      </div>

      {/* tin 파일 줄 — 파일마다 한 줄 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
        }}
      >
        {group.files.map((f) => (
          <div
            key={f.path}
            style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
          >
            <span className="ty-sub" style={{ minWidth: 78, flexShrink: 0 }} title={f.path}>
              {f.label}
            </span>
            <button
              // ★파일관리가 쓰는 경로는 "tin/" 접두사가 없다★ #read 는 프로젝트 루트
              //   기준(tin/...)이고, /api/files 는 tin 폴더 기준(1_기본/기본.tin)이다.
              //   여기서 떼어 넘기지 않으면 파일을 못 찾는다.
              onClick={() => onOpenFile(f.path.replace(/^tin\//, ""))}
              className="cc-btn"
              title={f.path}
            >
              <Eye className="size-3.5" />
              보기
            </button>
            <ReadCopyButton path={f.path} />
          </div>
        ))}
      </div>
    </article>
  )
}

