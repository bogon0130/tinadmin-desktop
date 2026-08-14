/**
 * 클립보드 복사 — Tauri 웹뷰에서도 되게 두 경로를 쓴다.
 *
 * ★왜 fallback 이 필요한가★
 *   Tauri 웹뷰는 환경에 따라 navigator.clipboard 가 막혀 있다(권한/보안 컨텍스트).
 *   그때는 화면 밖에 textarea 를 잠깐 만들어 execCommand('copy') 로 우회한다.
 *
 * 구현은 components/groups/group-dashboard.tsx 안에 있던 것과 같다. 새로 쓰는
 * 화면(main-view)이 같은 코드를 복사해 갖는 걸 막으려고 여기로 뺐다.
 * group-dashboard 쪽은 아직 자기 것을 쓰고 있다 — 손대면 돌아가는 화면을
 * 건드리게 되므로, 그쪽은 다음에 정리할 때 이 함수로 바꾼다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.left = "-9999px"
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}
