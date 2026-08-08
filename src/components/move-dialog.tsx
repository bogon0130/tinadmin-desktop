import { AlertTriangle, Loader2 } from "lucide-react"
import { useState } from "react"

import type { MoveCheck } from "@/lib/api"

/**
 * 참조당하는 파일을 옮기려 할 때 뜨는 경고.
 *
 * 서버가 기본적으로 409 로 막으므로, 여기서 [그래도 이동]을 눌러야만
 * force=1 로 강행한다. 참조 경로는 자동으로 안 고쳐지므로 그 사실을 명시한다.
 */
export function MoveWarnDialog({
  check,
  toDir,
  onClose,
  onConfirm,
}: {
  check: MoveCheck
  toDir: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="hud-panel tin-scroll max-h-[85vh] w-full max-w-lg overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="mb-3 font-semibold tracking-wide"
          style={{ fontSize: "var(--tin-fs-lg)", color: "#f5a524" }}
        >
          <AlertTriangle className="mr-1.5 inline size-4" />
          이 파일은 {check.referrer_count}곳에서 #read 됩니다
        </h3>

        <p className="mb-3 leading-relaxed" style={{ fontSize: "var(--tin-fs-sm)" }}>
          <b className="tin-mono">{check.name}</b> 을(를){" "}
          <b className="tin-mono">{toDir || "최상위"}</b> 로 옮기면 아래 줄들의 경로가
          깨져서 <b>다음 재접속 때 그 자반이 안 올라옵니다.</b>
        </p>

        <div
          className="tin-scroll mb-3 max-h-48 overflow-y-auto rounded-md border p-3"
          style={{
            borderColor: "rgb(255 95 86 / 0.45)",
            background: "rgb(255 95 86 / 0.10)",
          }}
        >
          <ul className="tin-mono space-y-0.5">
            {check.referrers.map((r, i) => (
              <li key={i} style={{ fontSize: "var(--tin-fs-sm)" }}>
                {r.source}:{r.line}
              </li>
            ))}
          </ul>
        </div>

        <p
          className="mb-4 leading-relaxed"
          style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.8 }}
        >
          경로는 <b>자동으로 고쳐지지 않습니다.</b> 옮긴 뒤 위 파일들의 #read 줄을
          직접 수정해야 합니다. 지금 도는 세션에는 영향이 없습니다(재접속 때 적용).
        </p>

        <div className="flex justify-end gap-2">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="rounded-md border px-3 py-1.5"
            style={{
              borderColor: "var(--tin-edge)",
              fontSize: "var(--tin-fs-sm)",
            }}
          >
            취소
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--destructive)", fontSize: "var(--tin-fs-sm)" }}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            그래도 이동
          </button>
        </div>
      </div>
    </div>
  )
}
