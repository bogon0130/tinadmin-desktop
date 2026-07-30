import { useMemo, useState } from "react"

import {
  initialValues,
  isFormComplete,
  type SnippetForm,
} from "@/lib/snippets"

/**
 * 양식 입력 폼 다이얼로그.
 *
 * 값을 받아 완성된 tin 한 줄을 만들어 넘긴다 — 편집기에는 꺾쇠 없이
 * 바로 쓸 수 있는 형태로 들어간다.
 */
export function SnippetFormDialog({
  form,
  onClose,
  onInsert,
}: {
  form: SnippetForm
  onClose: () => void
  onInsert: (text: string) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(form),
  )

  const preview = useMemo(() => {
    try {
      return form.build(values)
    } catch {
      return ""
    }
  }, [form, values])

  const complete = isFormComplete(form, values)
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }))

  const inputCls =
    "tin-mono w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:border-[var(--tin-accent)]"
  const inputStyle = { borderColor: "var(--tin-edge)" }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="hud-panel tin-scroll max-h-[88vh] w-full max-w-lg overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="tin-accent mb-1 font-semibold tracking-wide"
          style={{ fontSize: "var(--tin-fs-lg)" }}
        >
          {form.label}
        </h3>
        <p
          className="mb-4 leading-relaxed"
          style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.75 }}
        >
          {form.hint}
        </p>

        {form.fields.map((f) => (
          <div key={f.key} className="mb-3">
            <label
              className="mb-1.5 block"
              style={{ fontSize: "var(--tin-fs-sm)" }}
            >
              {f.label}
              {!f.required && (
                <span style={{ opacity: 0.6 }}> (선택)</span>
              )}
            </label>

            {f.kind === "radio" ? (
              <div className="flex gap-2">
                {f.options?.map((o) => {
                  const on = (values[f.key] ?? f.defaultValue) === o.value
                  return (
                    <button
                      key={o.value}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => set(f.key, o.value)}
                      className="rounded-md border px-3 py-1.5"
                      style={{
                        fontSize: "var(--tin-fs-sm)",
                        borderColor: on
                          ? "var(--tin-accent)"
                          : "var(--tin-edge)",
                        color: on ? "var(--tin-accent)" : "var(--tin-fg)",
                      }}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
            ) : f.kind === "textarea" ? (
              <textarea
                autoFocus={f === form.fields[0]}
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                spellCheck={false}
                rows={5}
                className={`${inputCls} resize-y`}
                style={{ ...inputStyle, whiteSpace: "pre" }}
              />
            ) : (
              <input
                autoFocus={f === form.fields[0]}
                type={f.kind === "number" ? "text" : "text"}
                inputMode={f.kind === "number" ? "numeric" : undefined}
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  set(
                    f.key,
                    // 숫자 칸은 숫자만 받는다
                    f.kind === "number"
                      ? e.target.value.replace(/[^\d]/g, "")
                      : e.target.value,
                  )
                }
                placeholder={f.placeholder}
                spellCheck={false}
                className={inputCls}
                style={inputStyle}
              />
            )}

            {f.hint && (
              <p
                className="mt-1 leading-snug"
                style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.65 }}
              >
                {f.hint}
              </p>
            )}
          </div>
        ))}

        {/* 미리보기 — 실제로 삽입될 문자열 그대로 */}
        <div className="mb-4">
          <div
            className="mb-1.5"
            style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.75 }}
          >
            이렇게 들어갑니다
          </div>
          <pre
            className="tin-mono tin-scroll overflow-x-auto rounded-md border p-3 leading-relaxed"
            style={{
              borderColor: "var(--tin-edge)",
              background: "var(--tin-panel2)",
              color: complete ? "var(--tin-accent)" : "var(--tin-fg)",
              opacity: complete ? 1 : 0.6,
              whiteSpace: "pre",
            }}
          >
            {preview || " "}
          </pre>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            className="rounded-md border px-3 py-1.5"
            style={{ ...inputStyle, fontSize: "var(--tin-fs-sm)" }}
          >
            취소
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            disabled={!complete}
            onClick={() => onInsert(preview)}
            className="rounded-md px-3 py-1.5 font-semibold disabled:opacity-40"
            style={{
              background: "var(--tin-accent)",
              color: "#06120c",
              fontSize: "var(--tin-fs-sm)",
            }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  )
}
