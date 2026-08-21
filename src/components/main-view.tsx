import { House } from "lucide-react"

import { GroupCard } from "@/components/groups/group-card"
import { GROUPS } from "@/components/groups/group-defs"

/**
 * 메인페이지 — 앱을 켜면 가장 먼저 뜨는 화면.
 *
 * ★"한 칸 안에 카드 쌓기" 원칙을 따른다★
 *   App.tsx 의 본문은 화면별 보조 패널을 옆에 붙이지 않는 한 칸짜리다.
 *   그래서 이 화면도 옆으로 벌리지 않고 세로로 카드를 쌓는다(.ui-sections).
 *
 * ★쫄 6캐릭은 여기 없다★ 2026-08-15 에 이 화면에 낱개로 흩어져 있던 쫄 카드
 *   6장을 좌측 메뉴 "쫄그룹" 의 전용 화면(components/jjol-view.tsx)으로 옮겼다.
 *   카드를 그리는 부품(GroupCard)은 두 화면이 함께 쓰므로 groups/group-card.tsx
 *   에 있다.
 */


export function MainView({ onOpenFile }: { onOpenFile: (name: string) => void }) {
  return (
    <div
      className="tin-scroll ui-sections min-h-0 flex-1 overflow-y-auto"
      style={{ padding: "var(--gap-sec)" }}
    >
      {/* 제목줄 */}
      <div className="ui-row" style={{ flexShrink: 0 }}>
        <House className="size-5" style={{ color: "var(--accent)" }} />
        <span className="ty-h">메인페이지</span>
        <span className="ty-sub">자주 쓰는 명령과 그룹 상태를 한자리에서</span>
      </div>

      {/* 공용 명령어 — 내용은 다음 단계 */}
      <section className="cc-panel">
        <p className="cc-panel-title">공용 명령어</p>
        <p className="ty-sub" style={{ marginTop: 10 }}>
          (준비 중)
        </p>
      </section>

      {/* 그룹 카드 6개 */}
      <section className="cc-panel">
        <p className="cc-panel-title">그룹</p>
        <div className="cc-card-grid" style={{ marginTop: 10 }}>
          {GROUPS.map((g) => (
            <GroupCard key={g.name} group={g} onOpenFile={onOpenFile} />
          ))}
        </div>
      </section>
    </div>
  )
}
