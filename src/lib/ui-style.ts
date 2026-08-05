import { applyTheme, loadTheme, saveTheme } from "./theme"

/**
 * UI 스타일(S1~S4) 전환 — 시안 비교용.
 *
 * 색/모서리/그림자 값은 index.css 의 :root[data-ui-style="s1".."s4"] 에 있다.
 * 여기서는 어느 스킨인지만 <html data-ui-style="..."> 로 표시한다.
 *
 * ★설정 패널이 인라인으로 주입한 값을 되돌려야 한다★
 *   theme.ts applyTheme 가 글자색/강조색/폰트/글자크기를 <html> 인라인
 *   스타일로 넣어서 CSS 파일 규칙을 이긴다. 스타일 전환의 결과가 보이려면
 *   그 값들을 스킨에 맞게 다시 넣어야 한다. 폰트는 4스타일 공통으로
 *   Pretendard 를 강제한다(시스템 기본 폰트 금지).
 */

export type UiStyle = "s1" | "s2" | "s3" | "s4"

const KEY = "tinadmin.uiStyle"

export const UI_STYLES: { id: UiStyle; label: string; hint: string }[] = [
  { id: "s1", label: "S1", hint: "Directory풍 — 다크 사이드바 + 라이트 본문, 보라 강조" },
  { id: "s2", label: "S2", hint: "부동산풍 — 전체 라이트, 큰 라운드, 그림자로 분리" },
  { id: "s3", label: "S3", hint: "Commerce풍 — 대시보드, 상단 요약 카드, 틸 강조" },
  { id: "s4", label: "S4", hint: "Lifestats풍 — 다크 글래스 카드 그리드" },
]

/** index.css 의 --text / --accent 와 같은 값이어야 한다 */
const COLORS: Record<UiStyle, { text: string; accent: string }> = {
  s1: { text: "#1f2733", accent: "#6b5bd2" },
  s2: { text: "#1b2430", accent: "#3b7ddd" },
  s3: { text: "#17212b", accent: "#0f8a80" },
  s4: { text: "#eceef3", accent: "#a78bfa" },
}

/** 4스타일 공통 — 시스템 기본 폰트를 쓰지 않는다 */
export const UI_FONT =
  `"Pretendard Variable", Pretendard, "Inter Variable", system-ui, sans-serif`

export const DEFAULT_UI_STYLE: UiStyle = "s1"

export function loadUiStyle(): UiStyle {
  try {
    const v = localStorage.getItem(KEY)
    return v === "s1" || v === "s2" || v === "s3" || v === "s4" ? v : DEFAULT_UI_STYLE
  } catch {
    return DEFAULT_UI_STYLE
  }
}

export function applyUiStyle(s: UiStyle, persist = true): void {
  document.documentElement.dataset.uiStyle = s

  const c = COLORS[s]
  const next = {
    ...loadTheme(),
    textColor: c.text,
    accentColor: c.accent,
    fontFamily: UI_FONT,
    // 본문 14px 로 고정 — 타이포 4단계를 흔들지 않게
    fontSize: 14,
  }
  applyTheme(next)

  if (persist) {
    saveTheme(next)
    try {
      localStorage.setItem(KEY, s)
    } catch {
      /* 저장 실패해도 이번 실행에는 적용된다 */
    }
  }
}
