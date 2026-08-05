/**
 * 화면 테마 설정 (글자색 / 강조색 / 폰트종류 / 폰트크기).
 * localStorage 에 저장되어 다음 실행 때도 유지되고,
 * :root 의 CSS 변수로 주입되어 전체 화면에 한 번에 반영된다.
 */

const KEY = "tinadmin.theme"

export interface ThemeSettings {
  /** 본문 글자색 — 기본 순백(#FFFFFF). 회색 계열은 쓰지 않는다. */
  textColor: string
  /** 강조색 — 헤더 / 중요 수치 / 게이지에만 사용 */
  accentColor: string
  /** 폰트 종류 (CSS font-family 값) */
  fontFamily: string
  /** 본문 기준 글자 크기(px). 한글 monospace 는 여기에 +1px 더 크게 그린다. */
  fontSize: number
}

export const FONT_OPTIONS: { label: string; value: string }[] = [
  {
    // 앱에 번들된 폰트. 시스템 기본(맑은 고딕 등)은 쓰지 않는다 — PC 마다
    // 글자 모양과 자간이 달라져 여백 설계가 무너진다.
    label: "Pretendard (기본)",
    value: `"Pretendard Variable", Pretendard, "Inter Variable", system-ui, sans-serif`,
  },
  {
    label: "고정폭 (D2Coding·Consolas)",
    value: `"D2Coding", "Cascadia Mono", Consolas, ui-monospace, SFMono-Regular, Menlo, monospace`,
  },
  {
    label: "맑은 고딕",
    value: `"Malgun Gothic", "맑은 고딕", sans-serif`,
  },
  {
    label: "나눔고딕",
    value: `"NanumGothic", "나눔고딕", sans-serif`,
  },
  {
    label: "시스템 기본",
    value: `"Inter Variable", ui-sans-serif, system-ui, "Malgun Gothic", sans-serif`,
  },
]

export const ACCENT_PRESETS = [
  { label: "초록", value: "#3ddc84" },
  { label: "청록", value: "#2fd4ff" },
  { label: "호박", value: "#f5a524" },
  { label: "보라", value: "#a78bfa" },
]

export const DEFAULT_THEME: ThemeSettings = {
  textColor: "#FFFFFF",
  accentColor: "#3ddc84",
  fontFamily: FONT_OPTIONS[0].value, // Pretendard
  fontSize: 14,
}

export function loadTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_THEME }
    return { ...DEFAULT_THEME, ...(JSON.parse(raw) as Partial<ThemeSettings>) }
  } catch {
    return { ...DEFAULT_THEME }
  }
}

export function saveTheme(t: ThemeSettings) {
  localStorage.setItem(KEY, JSON.stringify(t))
}

/** #RRGGBB → "r g b" (CSS color-mix / rgba 조합용) */
function hexToRgb(hex: string): string {
  const m = hex.trim().replace("#", "")
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return "255 255 255"
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/** CSS 변수로 주입 → 전체 화면에 즉시 반영 */
export function applyTheme(t: ThemeSettings) {
  const r = document.documentElement.style
  r.setProperty("--tin-fg", t.textColor)
  r.setProperty("--tin-fg-rgb", hexToRgb(t.textColor))
  r.setProperty("--tin-accent", t.accentColor)
  r.setProperty("--tin-accent-rgb", hexToRgb(t.accentColor))
  r.setProperty("--tin-font", t.fontFamily)
  r.setProperty("--tin-fs", `${t.fontSize}px`)
  // 한글 고정폭은 같은 px에서 작아 보여 한 단계(+1px) 크게 그린다
  r.setProperty("--tin-fs-mono", `${t.fontSize + 1}px`)
  r.setProperty("--tin-fs-sm", `${Math.max(10, t.fontSize - 2)}px`)
  r.setProperty("--tin-fs-lg", `${t.fontSize + 4}px`)
  r.setProperty("--tin-fs-xl", `${t.fontSize + 12}px`)
}
