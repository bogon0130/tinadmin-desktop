import { rawEntries } from "@/lib/tin-utils"
import type { TinEntry } from "@/lib/types"
import { replaceEntry } from "@/lib/tin-utils"

interface Props {
  entries: TinEntry[]
  onChange: (next: TinEntry[]) => void
}

export function RawView({ entries, onChange }: Props) {
  const items = rawEntries(entries)

  function update(id: number, text: string, type: "raw" | "comment") {
    onChange(replaceEntry(entries, id, { id, type, text } as TinEntry))
  }

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto p-5">
      <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-200/90">
        표로 쪼갤 수 없는 원본 블록들이다. <b>#config</b>, <b>#session</b>,{" "}
        <b>#read</b>, <b>#pathdir</b> 같은 설정과 <b>#if / #switch / #delay</b>가
        섞인 여러 줄짜리 자반이 여기 원문 그대로 들어있다. 중괄호 짝이 맞지 않으면
        저장이 거부되니 주의할 것.
      </p>

      {items.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          원본 항목이 없습니다.
        </div>
      )}

      <div className="space-y-3">
        {items.map((e) => {
          const text = "text" in e ? e.text : ""
          const isComment = e.type === "comment"
          return (
            <div
              key={e.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    isComment
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/15 text-primary"
                  }`}
                >
                  {isComment ? "주석 (#nop)" : "원본 블록"}
                </span>
              </div>
              <textarea
                value={text}
                spellCheck={false}
                onChange={(ev) =>
                  update(e.id, ev.target.value, isComment ? "comment" : "raw")
                }
                rows={Math.min(20, Math.max(2, text.split("\n").length))}
                className="font-mono-tin w-full resize-y rounded-md border border-input bg-background p-2.5 text-[13px] leading-relaxed whitespace-pre text-foreground outline-none focus:border-primary"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
