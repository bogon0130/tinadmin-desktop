import { useEffect, useState } from "react"
import { Download, Loader2, X } from "lucide-react"
import { check, type Update } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { isTauri } from "@tauri-apps/api/core"
import { toast } from "sonner"

type Phase = "idle" | "found" | "downloading" | "done" | "error"

/**
 * 앱이 켜질 때 GitHub Releases의 latest.json 을 확인해서
 * 새 버전이 있으면 설치할지 물어본다.
 *
 * ※ 브라우저(bun run dev)에서는 Tauri API가 없으므로 아무것도 하지 않는다.
 */
export function UpdateChecker() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    ;(async () => {
      try {
        const found = await check()
        if (!cancelled && found) {
          setUpdate(found)
          setPhase("found")
        }
      } catch (e) {
        // 업데이트 확인 실패는 앱 사용을 막지 않는다 (오프라인 등)
        console.warn("업데이트 확인 실패:", e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function install() {
    if (!update) return
    setPhase("downloading")
    setError(null)
    try {
      let downloaded = 0
      await update.downloadAndInstall((ev) => {
        if (ev.event === "Started") {
          setTotal(ev.data.contentLength ?? 0)
        } else if (ev.event === "Progress") {
          downloaded += ev.data.chunkLength
          setProgress(downloaded)
        }
      })
      setPhase("done")
      toast.success("업데이트 설치 완료", {
        description: "앱을 다시 시작합니다…",
      })
      setTimeout(() => void relaunch(), 1200)
    } catch (e) {
      setPhase("error")
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (phase === "idle" || !update) return null

  const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : 0

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 rounded-xl border border-primary/40 bg-card p-4 shadow-2xl">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-primary">
            새 버전이 있습니다
          </div>
          <div className="font-mono-tin text-[11px] text-muted-foreground">
            v{update.version}
            {update.currentVersion ? ` (현재 v${update.currentVersion})` : ""}
          </div>
        </div>
        {phase === "found" && (
          <button
            onClick={() => setPhase("idle")}
            className="text-muted-foreground hover:text-foreground"
            title="나중에"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {update.body && phase === "found" && (
        <p className="tin-scroll mb-3 max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
          {update.body}
        </p>
      )}

      {phase === "found" && (
        <div className="flex gap-2">
          <button
            onClick={() => void install()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
          >
            <Download className="size-3.5" />
            지금 설치
          </button>
          <button
            onClick={() => setPhase("idle")}
            className="rounded-md border border-border px-3 py-1.5 text-xs transition hover:bg-secondary"
          >
            나중에
          </button>
        </div>
      )}

      {phase === "downloading" && (
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            내려받는 중… {total > 0 ? `${pct}%` : ""}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="text-[11px] text-primary">
          설치 완료 — 앱을 다시 시작합니다…
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="mb-2 whitespace-pre-wrap text-[11px] text-destructive">
            업데이트 실패: {error}
          </div>
          <button
            onClick={() => setPhase("found")}
            className="rounded-md border border-border px-3 py-1.5 text-xs transition hover:bg-secondary"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}
