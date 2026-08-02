import { invoke } from "@tauri-apps/api/core"

/**
 * 예전 "명령 즐겨찾기"(quick_commands.json) — 마이그레이션 전용으로만 남겨둔다.
 *
 * 원클릭 즐겨찾기로 통합되면서 이 저장소는 더 쓰지 않는다.
 * 다만 예전 항목을 옮겨오기 위해 읽기만 유지한다. 파일은 지우지 않아서
 * 문제가 생기면 손으로 되돌릴 수 있다.
 */
export async function loadQuickRaw(): Promise<string> {
  try {
    return await invoke<string>("quickcmds_load")
  } catch {
    return ""
  }
}
