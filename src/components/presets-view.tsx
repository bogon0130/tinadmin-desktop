import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { getPresets, savePreset } from "@/lib/api"
import type { Preset, TinEntry } from "@/lib/types"

export function PresetsView({
  currentFile,
  entries,
}: {
  currentFile: string
  entries: TinEntry[]
}) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getPresets()
      .then(setPresets)
      .catch((e) => toast.error(String(e instanceof Error ? e.message : e)))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!name.trim()) {
      toast.error("프리셋 이름을 입력하세요.")
      return
    }
    setBusy(true)
    try {
      const list = await savePreset({
        name: name.trim(),
        description: desc.trim(),
        entries,
      })
      setPresets(list)
      setName("")
      setDesc("")
      toast.success(`프리셋 '${name.trim()}' 저장됨`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <h3 className="mb-1 text-sm font-semibold text-foreground">
          현재 파일을 프리셋으로 저장
        </h3>
        <p className="mb-3 text-[12px] text-muted-foreground">
          지금 열려 있는 <b className="font-mono-tin">{currentFile}</b>의 전체
          항목({entries.length}개)을 이름 붙여 서버에 보관한다. 나중에 참고하거나
          다른 캐릭터에 재사용할 때 쓴다.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="프리셋 이름 (예: 한비광 사냥세트)"
            className="min-w-52 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="설명 (선택)"
            className="min-w-52 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            저장
          </button>
        </div>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-foreground">
        저장된 프리셋
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 불러오는 중…
        </div>
      ) : presets.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          저장된 프리셋이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map((p) => (
            <div
              key={p.name}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono-tin text-sm font-semibold text-primary">
                  {p.name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {p.entries?.length ?? 0}개 항목
                </span>
              </div>
              {p.description && (
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {p.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
