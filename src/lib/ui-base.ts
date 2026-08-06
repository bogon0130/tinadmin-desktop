import { applyTheme, loadTheme } from "./theme"

/**
 * 확정된 기본 외형을 강제로 적용한다.
 *
 * ★왜 필요한가★
 *   글자색/강조색/폰트는 설정 패널(theme.ts applyTheme)이 <html> 인라인
 *   스타일로 주입해서 index.css 의 규칙을 이긴다. 시안을 고르며 localStorage
 *   에 남은 옛 값(노랑 강조 등)이 그대로 살아 있으면 확정된 톤이 안 나온다.
 *   그래서 시작할 때 색과 폰트만 확정값으로 덮어쓴다.
 *
 * 글자 크기는 건드리지 않는다 — 사용자가 설정에서 키운 값이 있을 수 있고,
 * 타이포 4단계는 index.css 의 --fs-* 가 따로 정한다.
 */

/** index.css 의 --text / --accent 와 같은 값이어야 한다 */
export const UI_TEXT = "#e8ecf2"
export const UI_ACCENT = "#5aa9e6"

export const UI_FONT =
  `"Pretendard Variable", Pretendard, "Inter Variable", system-ui, sans-serif`

export function applyUiBase(): void {
  applyTheme({
    ...loadTheme(),
    textColor: UI_TEXT,
    accentColor: UI_ACCENT,
    fontFamily: UI_FONT,
  })
}
