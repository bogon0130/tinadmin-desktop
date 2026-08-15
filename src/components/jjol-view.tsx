import { Users } from "lucide-react"

import { GroupCard, type GroupDef } from "@/components/groups/group-card"

/**
 * 쫄그룹 화면 — 졸일~졸육 6장을 한 화면에 모아 놓는다.
 *
 * ★왜 별도 화면인가★ 2026-08-15 처음엔 좌측 메뉴에 "└ 졸일"~"└ 졸육" 6개를
 *   낱개로 늘어놓고 카드도 메인페이지에 섞어 놨는데, 메뉴가 6줄이나 늘어 다른
 *   메뉴가 밀리고 메인페이지도 카드 12장이 되어 산만했다. 천마신군그룹처럼
 *   메뉴 한 항목으로 묶고 그 안에서 6장을 보여주는 쪽으로 정리했다.
 *
 * ★GroupView(천마신군·한비광)와는 다른 컴포넌트다★ 그쪽은 /api/groups 를 불러
 *   세션 하나의 창 상태를 그리는 대시보드고, 쫄은 캐릭터마다 세션이 따로라
 *   그 구조에 맞지 않는다. 게다가 config.GROUPS 에는 "쫄그룹" 이라는 항목 자체가
 *   없고 졸일~졸육 6개가 각각 등록돼 있어서, GROUP_VIEWS 로 태우면 그릴 그룹을
 *   못 찾는다. 그래서 App.tsx 에서 GROUP_VIEWS 를 거치지 않고 바로 이 화면을 연다.
 *
 * 카드 내용(5버튼·tin 파일줄·solo 확인창·startScript)은 메인페이지에 있던 것을
 * 그대로 옮긴 것이고, 그리는 부품은 groups/group-card.tsx 를 함께 쓴다.
 */

/**
 * 쫄 6캐릭.
 *
 * 다른 그룹과 달리 캐릭터 하나가 곧 그룹이고 세션도 각자다(jjol1~jjol6).
 * tin 도 조합 없이 하나뿐이라 파일 줄이 한 개다.
 *
 * ★시작 스크립트도 캐릭터마다 따로다(start_jjol1~6.sh)★ 처음엔 start_jjol.sh
 *   하나가 6개를 통째로 만들어서 한 카드를 눌러도 6명이 전부 재시작됐다.
 *   순환이 캐릭터별로 도는데 한 명 때문에 여섯을 흔드는 게 맞지 않아 쪼갰다.
 *   이제 각 카드의 [접속] 은 자기 세션 하나만 끊고 다시 띄운다(solo).
 */
const JJOL_GROUPS: GroupDef[] = [
  {
    name: "졸일",
    session: "jjol1",
    startScript: "start_jjol1.sh",
    solo: true,
    files: [{ label: "졸일", path: "tin/쫄그룹/졸일.tin" }],
  },
  {
    name: "졸이",
    session: "jjol2",
    startScript: "start_jjol2.sh",
    solo: true,
    files: [{ label: "졸이", path: "tin/쫄그룹/졸이.tin" }],
  },
  {
    name: "졸삼",
    session: "jjol3",
    startScript: "start_jjol3.sh",
    solo: true,
    files: [{ label: "졸삼", path: "tin/쫄그룹/졸삼.tin" }],
  },
  {
    name: "졸사",
    session: "jjol4",
    startScript: "start_jjol4.sh",
    solo: true,
    files: [{ label: "졸사", path: "tin/쫄그룹/졸사.tin" }],
  },
  {
    name: "졸오",
    session: "jjol5",
    startScript: "start_jjol5.sh",
    solo: true,
    files: [{ label: "졸오", path: "tin/쫄그룹/졸오.tin" }],
  },
  {
    name: "졸육",
    session: "jjol6",
    startScript: "start_jjol6.sh",
    solo: true,
    files: [{ label: "졸육", path: "tin/쫄그룹/졸육.tin" }],
  },
]

export function JjolView({ onOpenFile }: { onOpenFile: (name: string) => void }) {
  return (
    <div
      className="tin-scroll ui-sections min-h-0 flex-1 overflow-y-auto"
      style={{ padding: "var(--gap-sec)" }}
    >
      {/* 제목줄 */}
      <div className="ui-row" style={{ flexShrink: 0 }}>
        <Users className="size-5" style={{ color: "var(--accent)" }} />
        <span className="ty-h">쫄그룹</span>
        <span className="ty-sub">
          캐릭터마다 세션이 따로다 — 카드 하나를 눌러도 다른 쫄은 건드리지 않는다
        </span>
      </div>

      <section className="cc-panel">
        <p className="cc-panel-title">쫄 6캐릭</p>
        <div className="cc-card-grid" style={{ marginTop: 10 }}>
          {JJOL_GROUPS.map((g) => (
            <GroupCard key={g.name} group={g} onOpenFile={onOpenFile} />
          ))}
        </div>
      </section>
    </div>
  )
}
