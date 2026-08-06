import { useState } from "react"
import { Settings2, Star } from "lucide-react"

import { FavoritesPanel } from "@/components/favorites-panel"
import { QuickFavoritesPanel } from "@/components/quick-favorites-panel"
import { FavCommandCenter } from "@/components/favorites/fav-command-center"

/**
 * 즐겨찾기 화면 셸 — 제목줄과 [관리 도구] 토글만 그린다.
 *
 * 목록 본문(좌측 목록 + 우측 상세)은 favorites/fav-master-detail.tsx,
 * 데이터·접속은 favorites/use-favorites.ts. 폴더 만들기·드래그 이동·빠른
 * 추가·경로 고치기·.bat·원클릭 명령은 평소 쓰지 않으므로 접어두고, 필요할
 * 때만 [관리 도구]로 편다 — 이 패널들은 이번 개편 범위 밖이라 그대로 뒀다.
 *
 * 본문은 화면 높이를 꽉 채우는 좌우 분할(마스터-디테일)이라, 이 셸도
 * 페이지 전체 스크롤 대신 세로 flex 로 바꿔 본문이 남은 높이를 다 쓰게 한다.
 * 좌/우 패널은 각자 안에서 따로 스크롤된다.
 */
export function FavoritesView({ reloadKey }: { reloadKey: number }) {
  const [tools, setTools] = useState(false)

  return (
    <div
      className="tin-scroll min-h-0 flex-1 overflow-y-auto"
      style={{ padding: "var(--gap-sec)", gap: "var(--gap-sec)" }}
    >
      <div className="ui-row" style={{ flexShrink: 0 }}>
        <Star className="size-5" style={{ color: "var(--accent)" }} />
        <span className="ty-h">즐겨찾기</span>
        <span className="ty-sub">CONNECT 를 누르면 저장된 방식대로 접속합니다</span>
        <button
          onClick={() => setTools((v) => !v)}
          className="ui-btn"
          style={{ marginLeft: "auto" }}
          title="폴더 만들기 · 드래그 이동 · 빠른 추가 · 경로 고치기 · .bat · 원클릭 명령"
        >
          <Settings2 className="size-4" />
          관리 도구
        </button>
      </div>

      <FavCommandCenter reloadKey={reloadKey} />

      {tools && (
        <div className="tin-scroll ui-sections" style={{ flexShrink: 0, maxHeight: "45vh", overflowY: "auto" }}>
          <FavoritesPanel reloadKey={reloadKey} />
          <QuickFavoritesPanel />
        </div>
      )}
    </div>
  )
}
