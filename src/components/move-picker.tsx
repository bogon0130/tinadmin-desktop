import { Folder, FolderUp, Loader2 } from "lucide-react"
import { useState } from "react"

import { moveTargets } from "@/lib/move-utils"

/**
 * 폴더 선택 팝업 — 드래그가 안 되는 환경을 위한 확실한 이동 경로.
 *
 * WebView2 에서 HTML5 드래그앤드롭이 불안정할 수 있어, 버튼으로도 같은 일을
 * 할 수 있게 둔다. 참조검사 -> 경고팝업 흐름은 드래그 경로와 동일하다.
 */
export function MovePickerDialog({
  fileName,
  dirs,
  onClose,
  onPick,
}: {
  fileName: string
  dirs: string[]
  onClose: () => void
  onPick: (toDir: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const targets = moveTargets(fileName, dirs)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="hud-panel tin-scroll max-h-[80vh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="tin-accent mb-1 font-semibold tracking-wide"
          style={{ fontSize: "var(--tin-fs-lg)" }}
        >
          어느 폴더로 옮길까요?
        </h3>
        <p
          className="tin-mono mb-4"
          style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.8 }}
        >
          {fileName}
        </p>

        {targets.length === 0 ? (
          <p style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.75 }}>
            옮길 수 있는 폴더가 없습니다. 먼저 폴더를 만들어주세요.
          </p>
        ) : (
          <div className="space-y-1.5">
            {targets.map((d) => (
              <button
                key={d || "__root__"}
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(d)
                  try {
                    await onPick(d)
                  } finally {
                    setBusy(null)
                  }
                }}
                className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition hover:border-[var(--tin-accent)] disabled:opacity-50"
                style={{
                  borderColor: "var(--tin-edge)",
                  fontSize: "var(--tin-fs-sm)",
                }}
              >
                {busy === d ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : d === "" ? (
                  <FolderUp className="size-4" />
                ) : (
                  <Folder className="size-4" />
                )}
                <span className="tin-mono">{d === "" ? "최상위로" : d}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border px-3 py-1.5"
            style={{
              borderColor: "var(--tin-edge)",
              fontSize: "var(--tin-fs-sm)",
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
