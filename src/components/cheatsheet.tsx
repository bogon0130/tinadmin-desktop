import { PATTERN_TIPS, TYPE_META } from "@/lib/tin-utils"
import type { TableType } from "@/lib/types"

export function Cheatsheet({ type }: { type: TableType }) {
  const meta = TYPE_META[type]
  return (
    <aside className="tin-scroll hidden w-80 shrink-0 overflow-y-auto border-l border-border bg-sidebar/40 p-5 xl:block">
      <h3 className="mb-3 text-sm font-semibold text-primary">문법</h3>
      <pre className="font-mono-tin mb-4 overflow-x-auto rounded-md border border-border bg-background px-3 py-2.5 text-[12px] leading-relaxed text-foreground">
        {meta.syntax}
      </pre>

      <ul className="mb-6 space-y-2">
        {meta.help.map((h, i) => (
          <li
            key={i}
            className="font-mono-tin text-[12px] leading-relaxed text-muted-foreground"
          >
            {h}
          </li>
        ))}
      </ul>

      <h3 className="mb-3 text-sm font-semibold text-primary">패턴 특수문자</h3>
      <dl className="space-y-2.5">
        {PATTERN_TIPS.map(([sym, desc]) => (
          <div key={sym}>
            <dt className="font-mono-tin text-[12px] font-semibold text-foreground">
              {sym}
            </dt>
            <dd className="text-[12px] leading-snug text-muted-foreground">
              {desc}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200/90">
        여러 줄에 걸친 복잡한 자반(#if, #switch, #delay 등)은 표로 쪼개지 않고
        <b> Raw 편집</b> 탭에 원문 그대로 있다. 그런 건 거기서 고칠 것.
      </div>

      <div className="mt-3 rounded-md border border-primary/25 bg-primary/10 p-3 text-[11px] leading-relaxed text-primary/90">
        저장하면 ① 중괄호 짝 검사 → ② 서버에 자동 백업 → ③ 파일 저장 →
        ④ tmux의 tt++에 <b>#read</b>로 즉시 반영된다.
      </div>
    </aside>
  )
}
