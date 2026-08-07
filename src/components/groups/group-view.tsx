import { useState } from "react"
import { BookOpen } from "lucide-react"

import { GroupDashboard } from "@/components/groups/group-dashboard"
import { GroupDocView } from "@/components/group-doc-view"

/**
 * 그룹 화면 셸 — 대시보드(기본)가 앞이고, 옛 운영 참고서 문서는 토글 뒤로.
 *
 * ★문서를 없애지 않은 이유★
 *   완전재접(tmux respawn-pane) 명령 예시가 지금 이 문서에만 있다(1단계
 *   조사에서 확인 — 코드/버튼으로는 아직 없음). 대시보드는 "정보 표시"만
 *   하는 1단계라 그 명령을 대신하지 못한다. 그래서 즐겨찾기 화면의
 *   [관리 도구] 토글과 같은 패턴으로 접어서 남겨뒀다 — 필요할 때 펼쳐
 *   그대로 복사해 쓸 수 있다. group-doc-view.tsx 는 그대로 재사용(무수정).
 */
export function GroupView({ groupName }: { groupName: string }) {
  const [showDoc, setShowDoc] = useState(false)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GroupDashboard groupName={groupName} />

      <div style={{ padding: "0 var(--gap-sec) var(--gap-sec)" }}>
        <button
          onClick={() => setShowDoc((v) => !v)}
          className="cc-btn"
          style={{ width: "100%", justifyContent: "center" }}
        >
          <BookOpen className="size-3.5" />
          {showDoc ? "운영 참고서 원문 접기" : "운영 참고서 원문 (완전재접 명령 등)"}
        </button>
      </div>

      {showDoc && (
        // GroupDocView 자신이 flex-1(min-h-0) 라 부모도 같은 규칙을 지켜야
        // 내부 스크롤이 제대로 잡힌다 — 대시보드와 위아래로 공간을 나눠 갖는다.
        <div className="flex min-h-0" style={{ flex: "1 1 0%" }}>
          <GroupDocView docKey={groupName} />
        </div>
      )}
    </div>
  )
}
