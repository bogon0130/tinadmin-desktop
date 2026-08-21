import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Loader2, Pencil, Plus, Trash2, Wand2 } from "lucide-react"
import { toast } from "sonner"

import { SnippetFormDialog } from "@/components/snippet-form"
import { SNIPPET_FORMS, type SnippetForm } from "@/lib/snippets"
import { PATTERN_TIPS, TYPE_META } from "@/lib/tin-utils"
import {
  EMPTY_SNIPS,
  loadSnips,
  newSnipId,
  removeSnip,
  saveSnips,
  upsertSnip,
  validSnipLabel,
  validSnipText,
  type MySnip,
  type MySnipStore,
} from "@/lib/mysnips"
import type { TableType } from "@/lib/types"
import { copyText } from "@/lib/clipboard"

/**
 * 사용법 — tin 문법과 예제를 한자리에 모아둔 화면.
 *
 * ★"패널"이 아니라 본문이다★
 *   예전에는 자반 편집 표 옆에 좁은 도움말 패널(Cheatsheet)로 붙어 있어서
 *   넓은 화면에서만 보였고(xl:block), 표를 안 쓰면 볼 방법이 없었다.
 *   메뉴로 꺼내 본문 카드로 펼친다.
 *
 * 재료는 전부 기존 것을 재사용한다 —
 *   문법/도움말: lib/tin-utils 의 TYPE_META (자반 표가 쓰던 것과 같은 원본)
 *   패턴 특수문자: lib/tin-utils 의 PATTERN_TIPS (치트시트와 같은 원본)
 *   예제와 만들기 폼: lib/snippets 의 SNIPPET_FORMS + SnippetFormDialog
 */

/** 사용법에서 문법을 보여줄 종류 — 실제로 자주 쓰는 것만 추린다 */
const GUIDE_TYPES: TableType[] = ["action", "alias", "ticker"]

/**
 * 폼의 placeholder 를 채워 "이렇게 생겼다" 예제 한 줄을 만든다.
 *
 * placeholder 가 "(비워도 됨)" 처럼 안내문일 때는 빈 값으로 둔다 —
 * 그대로 넣으면 예제에 안내문이 박혀버린다.
 */
function exampleOf(form: SnippetForm): string {
  const v: Record<string, string> = {}
  for (const f of form.fields) {
    const ph = f.placeholder?.startsWith("(") ? "" : (f.placeholder ?? "")
    v[f.key] = f.defaultValue ?? ph
  }
  try {
    return form.build(v)
  } catch {
    return ""
  }
}

/** 클립보드 복사 — Tauri 웹뷰에서 clipboard API 가 막혀도 되도록 대비한다 */
/** 복사 버튼 — 누르면 잠깐 체크 표시로 바뀐다 */
function CopyButton({ text, title }: { text: string; title?: string }) {
  const [done, setDone] = useState(false)

  return (
    <button
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        } else {
          toast.error("복사하지 못했습니다", { description: "직접 선택해 복사해 주세요." })
        }
      }}
      title={title ?? "복사"}
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs transition hover:bg-sidebar-accent/60"
    >
      {done ? (
        <>
          <Check className="size-3.5 text-primary" /> 복사됨
        </>
      ) : (
        <>
          <Copy className="size-3.5" /> 복사
        </>
      )}
    </button>
  )
}

/** 한 줄짜리 코드 상자 */
function CodeLine({ children }: { children: string }) {
  return (
    <pre className="font-mono-tin tin-scroll min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-[12px] leading-relaxed text-foreground">
      {children}
    </pre>
  )
}

function Section({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <h3 className="mb-1 text-sm font-semibold text-primary">{title}</h3>
      {desc && <p className="mb-3 text-[12px] text-muted-foreground">{desc}</p>}
      {children}
    </section>
  )
}

export function GuideView() {
  const [form, setForm] = useState<SnippetForm | null>(null)
  const [snips, setSnips] = useState<MySnipStore>(EMPTY_SNIPS)
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<MySnip | null>(null)

  useEffect(() => {
    loadSnips()
      .then(setSnips)
      .finally(() => setLoading(false))
  }, [])

  const persist = useCallback(async (next: MySnipStore) => {
    setSnips(next)
    try {
      await saveSnips(next)
    } catch (e) {
      toast.error("저장 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }, [])

  function saveEdit() {
    if (!edit) return
    const badLabel = validSnipLabel(edit.label)
    if (badLabel) return toast.error(badLabel)
    const badText = validSnipText(edit.text)
    if (badText) return toast.error(badText)
    void persist(
      upsertSnip(snips, {
        ...edit,
        label: edit.label.trim(),
        text: edit.text.trim(),
      }),
    )
    setEdit(null)
    toast.success("저장했습니다")
  }

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-3xl">
        {/* ---------------- 1) 문법 기초 ---------------- */}
        <Section
          title="문법 기초"
          desc="tin 파일에 들어가는 한 줄이 어떤 모양인지 먼저 익힌다."
        >
          <div className="space-y-3">
            {GUIDE_TYPES.map((t) => {
              const meta = TYPE_META[t]
              return (
                <div
                  key={t}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{meta.label}</span>
                    <span className="font-mono-tin text-[11px] text-muted-foreground">
                      #{t}
                    </span>
                  </div>
                  <div className="mb-3 flex items-start gap-2">
                    <CodeLine>{meta.syntax}</CodeLine>
                    <CopyButton text={meta.syntax} />
                  </div>
                  <ul className="space-y-1.5">
                    {meta.help.map((h, i) => (
                      <li
                        key={i}
                        className="font-mono-tin text-[12px] leading-relaxed text-muted-foreground"
                      >
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}

            {/* 패턴 특수문자 — cheatsheet 와 같은 원본을 쓴다 */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 text-[13px] font-semibold">패턴 특수문자</div>
              <dl className="grid gap-3 sm:grid-cols-2">
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
            </div>
          </div>
        </Section>

        {/* ---------------- 2) 예제 ---------------- */}
        <Section
          title="자반 · 줄임말 · 반복 예제"
          desc="[복사]로 예제를 그대로 가져가거나, [만들기]로 빈칸만 채워 완성된 한 줄을 얻는다."
        >
          <div className="space-y-3">
            {SNIPPET_FORMS.map((f) => {
              const ex = exampleOf(f)
              return (
                <div
                  key={f.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[13px] font-semibold">{f.label}</span>
                    <button
                      onClick={() => setForm(f)}
                      className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs transition hover:bg-sidebar-accent/60"
                    >
                      <Wand2 className="size-3.5" /> 만들기
                    </button>
                  </div>
                  <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
                    {f.hint}
                  </p>
                  <div className="flex items-start gap-2">
                    <CodeLine>{ex}</CodeLine>
                    <CopyButton text={ex} />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ---------------- 3) 내 단골 명령 ---------------- */}
        <Section
          title="내 단골 명령"
          desc="자주 쓰는 줄을 이 PC 에 모아둔다. 즐겨찾기와 달리 서버로 올리지 않는다."
        >
          <div className="mb-3">
            <button
              onClick={() => setEdit({ id: newSnipId(), label: "", text: "" })}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
            >
              <Plus className="size-3.5" /> 새로 추가
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 불러오는 중…
            </div>
          ) : snips.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-[12px] text-muted-foreground">
              아직 저장한 명령이 없습니다. 위 예제에서 [만들기]로 한 줄을 만든 뒤
              여기에 담아두면 다음에 바로 꺼내 쓸 수 있습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {snips.items.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold">
                      {s.label}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <CopyButton text={s.text} />
                      <button
                        onClick={() => setEdit(s)}
                        title="수정"
                        className="flex size-7 items-center justify-center rounded-md border border-input transition hover:bg-sidebar-accent/60"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(`"${s.label}" 을(를) 지울까요?`)) return
                          void persist(removeSnip(snips, s.id))
                        }}
                        title="삭제"
                        className="flex size-7 items-center justify-center rounded-md border border-input transition hover:bg-destructive/20"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <pre className="font-mono-tin tin-scroll overflow-x-auto rounded-md border border-border bg-background px-3 py-2 text-[12px] leading-relaxed">
                    {s.text}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* 예제 -> 값 채우기 폼. 만든 줄은 바로 단골 명령으로 담는다 */}
      {form && (
        <SnippetFormDialog
          form={form}
          onClose={() => setForm(null)}
          onInsert={(text) => {
            setForm(null)
            setEdit({ id: newSnipId(), label: form.label, text })
          }}
        />
      )}

      {/* 단골 명령 추가/수정 */}
      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
          onClick={() => setEdit(null)}
        >
          <div
            className="hud-panel w-full max-w-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="tin-accent mb-4 font-semibold tracking-wide"
              style={{ fontSize: "var(--tin-fs-lg)" }}
            >
              단골 명령
            </h3>

            <label className="mb-1.5 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
              이름
            </label>
            <input
              autoFocus
              value={edit.label}
              onChange={(e) => setEdit({ ...edit, label: e.target.value })}
              placeholder="죽으면 시체 회수"
              spellCheck={false}
              className="mb-3 w-full rounded-md border border-[var(--tin-edge)] bg-transparent px-3 py-2 outline-none focus:border-[var(--tin-accent)]"
            />

            <label className="mb-1.5 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
              명령 (tin 에 들어갈 그대로)
            </label>
            <textarea
              value={edit.text}
              onChange={(e) => setEdit({ ...edit, text: e.target.value })}
              placeholder="#action {당신은 죽었습니다!} {시체}"
              spellCheck={false}
              rows={5}
              className="tin-mono mb-4 w-full resize-y rounded-md border border-[var(--tin-edge)] bg-transparent px-3 py-2 outline-none focus:border-[var(--tin-accent)]"
              style={{ whiteSpace: "pre" }}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEdit(null)}
                className="rounded-md border border-[var(--tin-edge)] px-3 py-1.5"
                style={{ fontSize: "var(--tin-fs-sm)" }}
              >
                취소
              </button>
              <button
                onClick={saveEdit}
                className="rounded-md px-3 py-1.5 font-semibold"
                style={{
                  fontSize: "var(--tin-fs-sm)",
                  background: "var(--tin-accent)",
                  color: "#06120c",
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
