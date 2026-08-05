import { FavoritesPanel } from "@/components/favorites-panel"
import { QuickFavoritesPanel } from "@/components/quick-favorites-panel"

/**
 * 즐겨찾기 화면 — 공통 뼈대(사이드바 + 콘텐츠 한 칸)에 맞춘 첫 화면.
 *
 * 예전에는 접속 즐겨찾기가 왼쪽 사이드바 안에, 원클릭 명령이 오른쪽 별도
 * 패널에 있어서 한 기능이 화면 세 곳에 흩어져 있었다. 둘 다 콘텐츠 한 칸
 * 안으로 모아 위아래로 쌓는다.
 *
 * 여기서는 배치만 한다 — 접속(comboCreate -> comboConnect -> open_terminal)과
 * 명령 전송 로직은 각 패널 안에 그대로 있다.
 */
export function FavoritesView({ reloadKey }: { reloadKey: number }) {
  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <FavoritesPanel reloadKey={reloadKey} />
        <QuickFavoritesPanel />
      </div>
    </div>
  )
}
