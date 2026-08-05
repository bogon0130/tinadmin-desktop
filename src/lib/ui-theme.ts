import { applyTheme, loadTheme, saveTheme } from "./theme"

/**
 * UI 테마(A/B) 전환.
 *
 * 색값 자체는 index.css 의 :root[data-ui-theme="a"|"b"] 에 있다. 여기서는
 * 어느 테마인지만 정해 <html data-ui-theme="..."> 로 표시한다.
 *
 * ★한 가지 예외를 처리해야 한다★
 *   글자색/강조색은 설정 패널(theme.ts applyTheme)이 <html> 인라인 스타일로
 *   주입해서 CSS 파일의 규칙을 이긴다. 그래서 테마를 바꿀 때 두 값만
 *   테마에 맞게 다시 주입한다. 폰트 종류·크기 설정은 그대로 둔다
 *   (사용자가 고른 값이고 테마와 무관하다).
 */

export type UiTheme = "a" | "b"

const KEY = "tinadmin.uiTheme"

export const UI_THEMES: { id: UiTheme; label: string; hint: string }[] = [
  { id: "a", label: "A", hint: "네이비 + 노랑 (어두운 화면)" },
  { id: "b", label: "B", hint: "파스텔 (밝은 화면)" },
]

/** 테마별 글자색/강조색 — index.css 의 --text / --accent 와 같은 값이어야 한다 */
const COLORS: Record<UiTheme, { text: string; accent: string }> = {
  a: { text: "#f5f7fa", accent: "#f5c518" },
  b: { text: "#26324d", accent: "#5b8def" },
}

export const DEFAULT_UI_THEME: UiTheme = "a"

export function loadUiTheme(): UiTheme {
  try {
    const v = localStorage.getItem(KEY)
    return v === "a" || v === "b" ? v : DEFAULT_UI_THEME
  } catch {
    return DEFAULT_UI_THEME
  }
}

/**
 * 테마를 화면에 적용한다. 저장까지 하려면 persist=true.
 * 앱 시작 시에는 저장 없이 적용만 해도 된다.
 */
export function applyUiTheme(t: UiTheme, persist = true): void {
  document.documentElement.dataset.uiTheme = t

  // 인라인으로 박혀 있는 글자색/강조색을 테마 값으로 덮어쓴다
  const c = COLORS[t]
  const next = { ...loadTheme(), textColor: c.text, accentColor: c.accent }
  applyTheme(next)

  if (persist) {
    saveTheme(next)
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* 저장 실패해도 이번 실행에는 적용된다 */
    }
  }
}
