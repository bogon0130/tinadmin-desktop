import { useState } from "react"
import { Settings2, Star } from "lucide-react"

import { FavoritesPanel } from "@/components/favorites-panel"
import { QuickFavoritesPanel } from "@/components/quick-favorites-panel"
import { FavS1 } from "@/components/favorites/fav-s1"
import { FavS2 } from "@/components/favorites/fav-s2"
import { FavS3 } from "@/components/favorites/fav-s3"
import { FavS4 } from "@/components/favorites/fav-s4"
import type { UiStyle } from "@/lib/ui-style"

/**
 * 즐겨찾기 화면 셸.
 *
 * 제목줄과 [관리 도구] 토글만 여기서 그리고, 본문은 시안(S1~S4) 컴포넌트에
 * 넘긴다. 시안 4개는 배치·정보밀도가 서로 다르지만 데이터와 접속 동작은
 * components/favorites/use-favorites.ts 하나를 공유한다.
 *
 * [임시 — 스타일 확정 후 정리] 확정되면 고른 시안만 남기고 분기를 없앤다.
 */

const BODY: Record<UiStyle, (p: { reloadKey: number }) => React.ReactElement> = {
  s1: FavS1,
  s2: FavS2,
  s3: FavS3,
  s4: FavS4,
}

const CAPTION: Record<UiStyle, string> = {
  s1: "컴팩트 목록 — 왼쪽 폴더에서 고르고 오른쪽에서 바로 접속",
  s2: "큰 카드 — 항목 하나가 카드 하나",
  s3: "대시보드 — 요약 숫자와 정렬되는 표",
  s4: "위젯 — 폴더별 패널에서 칩을 눌러 접속",
}

export function FavoritesView({
  reloadKey,
  uiStyle,
}: {
  reloadKey: number
  uiStyle: UiStyle
}) {
  const [tools, setTools] = useState(false)
  const Body = BODY[uiStyle]

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto" style={{ padding: "var(--gap-sec)" }}>
      <div className="mx-auto ui-sections" style={{ maxWidth: 1180 }}>
        <div className="ui-row">
          <Star className="size-5" style={{ color: "var(--accent)" }} />
          <span className="ty-h">즐겨찾기</span>
          <span className="ty-sub">{CAPTION[uiStyle]}</span>
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

        <Body reloadKey={reloadKey} />

        {/* 기존 관리 기능은 4개 시안 모두에서 여기로 접근한다 (기능 손실 방지) */}
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
