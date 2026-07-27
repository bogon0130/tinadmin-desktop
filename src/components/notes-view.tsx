import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { getNotes, saveNotes } from "@/lib/api"

export function NotesView() {
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getNotes()
      .then(setContent)
      .catch((e) => toast.error(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setBusy(true)
    try {
      await saveNotes(content)
      toast.success("메모 저장됨")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <div className="mb-3 flex items-center gap-3">
        <p className="text-[12px] text-muted-foreground">
          서버에 저장되는 자유 메모장이다. 몹 이름, 사냥터 문구, 확인할 것 등을
          적어두면 어느 PC에서 열어도 그대로 보인다.
        </p>
        <button
          onClick={handleSave}
          disabled={busy || loading}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          저장
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 불러오는 중…
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          placeholder="여기에 메모를 적으세요…"
          className="font-mono-tin tin-scroll min-h-0 flex-1 resize-none rounded-lg border border-input bg-background p-4 text-[13px] leading-relaxed text-foreground outline-none focus:border-primary"
        />
      )}
    </div>
  )
}
