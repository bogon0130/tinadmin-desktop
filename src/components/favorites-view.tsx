import { useState } from "react"
import { Settings2, Star } from "lucide-react"

import { FavoritesPanel } from "@/components/favorites-panel"
import { QuickFavoritesPanel } from "@/components/quick-favorites-panel"
import { FavMain } from "@/components/favorites/fav-main"

/**
 * 즐겨찾기 화면 셸 — 제목줄과 [관리 도구] 토글만 그린다.
 *
 * 목록 본문은 favorites/fav-main.tsx, 데이터·접속은 favorites/use-favorites.ts.
 * 폴더 만들기·드래그 이동·빠른 추가·경로 고치기·.bat·원클릭 명령은 평소 쓰지
 * 않으므로 접어두고, 필요할 때만 [관리 도구]로 편다.
 */
export function FavoritesView({ reloadKey }: { reloadKey: number }) {
  const [tools, setTools] = useState(false)

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto" style={{ padding: "var(--gap-sec)" }}>
      <div className="mx-auto ui-sections" style={{ maxWidth: 1180 }}>
        <div className="ui-row">
          <Star className="size-5" style={{ color: "var(--accent)" }} />
          <span className="ty-h">즐겨찾기</span>
          <span className="ty-sub">카드를 누르면 접속, 아래 메모는 모든 PC에 공유됩니다</span>
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

        <FavMain reloadKey={reloadKey} />

        {tools && (
          <div className="ui-sections">
            <FavoritesPanel reloadKey={reloadKey} />
            <QuickFavoritesPanel />
          </div>
        )}
      </div>
    </div>
  )
}
