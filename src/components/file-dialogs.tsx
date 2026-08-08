import { useEffect, useState } from "react"
import { AlertTriangle, Loader2, Lock } from "lucide-react"

import { getFileRefs, type RefsResult, type TinFileMeta } from "@/lib/api"

/** 파일명 규칙 — 서버 safepath.NAME_PATTERN 과 같은 규칙을 화면에서도 미리 검사 */
const NAME_RE = /^[가-힣a-zA-Z0-9_-]{1,30}$/

export function validateName(stem: string): string | null {
  const s = stem.trim()
  if (!s) return "파일 이름을 입력하세요."
  if (s.startsWith("_")) return "파일 이름은 '_' 로 시작할 수 없습니다."
  if (!NAME_RE.test(s))
    return "한글·영문·숫자·_·- 만 쓸 수 있습니다 (1~30자). 공백과 특수문자( ; $ * \" )는 tt++ 의 #read 를 깨뜨립니다."
  return null
}

function Shell({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="hud-panel tin-scroll max-h-[85vh] w-full max-w-md overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="tin-accent mb-4 font-semibold tracking-wide"
          style={{ fontSize: "var(--tin-fs-lg)" }}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  )
}

const inputCls =
  "tin-mono w-full rounded-md border bg-transparent px-3 py-2 outline-none"
const inputStyle = { borderColor: "var(--tin-edge)" }
const btnGhost =
  "rounded-md border px-3 py-1.5 transition hover:border-[var(--tin-accent)]"

/** 새 파일 만들기 */
export function CreateDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const err = name ? validateName(name) : null

  return (
    <Shell title="새 파일 만들기" onClose={onClose}>
      <label className="mb-1.5 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
        파일 이름 (확장자 .tin 은 자동으로 붙습니다)
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="예: 사냥보조"
        spellCheck={false}
        className={inputCls}
        style={inputStyle}
      />
      {err && (
        <div
          className="mt-2 rounded-md border px-3 py-2 leading-relaxed"
          style={{
            borderColor: "rgb(255 95 86 / 0.4)",
            background: "rgb(255 95 86 / 0.1)",
            fontSize: "var(--tin-fs-sm)",
          }}
        >
          {err}
        </div>
      )}
      <p
        className="mt-3 leading-relaxed"
        style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.75 }}
      >
        만들면 <span className="tin-mono">#config {"{CHARSET}"} {"{CP949TOUTF8}"}</span>{" "}
        가 들어간 기본 틀로 생성됩니다. (이 줄이 없으면 한글이 깨집니다)
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost} style={inputStyle}>
          취소
        </button>
        <button
          disabled={busy || !name || !!err}
          onClick={async () => {
            setBusy(true)
            try {
              await onCreate(name.trim())
            } finally {
              setBusy(false)
            }
          }}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold disabled:opacity-50"
          style={{ background: "var(--tin-accent)", color: "#06120c" }}
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          만들기
        </button>
      </div>
    </Shell>
  )
}

/** 참조 목록 표시 — 삭제/이름변경을 막는 이유를 보여준다 */
function RefWarning({ refs }: { refs: RefsResult }) {
  if (refs.referrer_count === 0) {
    return (
      <div
        className="mb-3 rounded-md border px-3 py-2"
        style={{
          borderColor: "var(--tin-edge)",
          fontSize: "var(--tin-fs-sm)",
        }}
      >
        이 파일을 <b>#read 하는 파일이 없습니다.</b> 진행해도 다른 파일이 깨지지
        않습니다.
      </div>
    )
  }
  return (
    <div
      className="mb-3 rounded-md border px-3 py-2 leading-relaxed"
      style={{
        borderColor: "rgb(255 95 86 / 0.45)",
        background: "rgb(255 95 86 / 0.12)",
        fontSize: "var(--tin-fs-sm)",
      }}
    >
      <AlertTriangle className="mr-1 inline size-3.5" />
      <b>{refs.referrer_count}개 파일</b>이 이 파일을 #read 로 사용 중입니다.
      먼저 아래 줄에서 참조를 제거해야 합니다:
      <ul className="tin-mono mt-1.5 space-y-0.5 pl-4">
        {refs.referrers.map((r, i) => (
          <li key={i} className="list-disc">
            {r.source}:{r.line}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 이름 바꾸기 */
export function RenameDialog({
  file,
  onClose,
  onRename,
}: {
  file: TinFileMeta
  onClose: () => void
  onRename: (newName: string) => Promise<void>
}) {
  const [name, setName] = useState(file.name.replace(/\.tin$/, ""))
  const [refs, setRefs] = useState<RefsResult | null>(null)
  const [busy, setBusy] = useState(false)
  const err = name ? validateName(name) : null

  useEffect(() => {
    getFileRefs(file.name)
      .then(setRefs)
      .catch(() => setRefs(null))
  }, [file.name])

  const blocked = (refs?.referrer_count ?? 0) > 0

  return (
    <Shell title={`이름 바꾸기 — ${file.name}`} onClose={onClose}>
      {refs ? <RefWarning refs={refs} /> : null}
      <label className="mb-1.5 block" style={{ fontSize: "var(--tin-fs-sm)" }}>
        새 이름
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        spellCheck={false}
        disabled={blocked}
        className={inputCls}
        style={{ ...inputStyle, opacity: blocked ? 0.5 : 1 }}
      />
      {err && !blocked && (
        <div
          className="mt-2 rounded-md border px-3 py-2"
          style={{
            borderColor: "rgb(255 95 86 / 0.4)",
            background: "rgb(255 95 86 / 0.1)",
            fontSize: "var(--tin-fs-sm)",
          }}
        >
          {err}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost} style={inputStyle}>
          닫기
        </button>
        <button
          disabled={busy || blocked || !!err || name === file.name.replace(/\.tin$/, "")}
          onClick={async () => {
            setBusy(true)
            try {
              await onRename(name.trim())
            } finally {
              setBusy(false)
            }
          }}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold disabled:opacity-50"
          style={{ background: "var(--tin-accent)", color: "#06120c" }}
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          이름 바꾸기
        </button>
      </div>
    </Shell>
  )
}

/** 삭제 (휴지통 이동) */
export function DeleteDialog({
  file,
  inUseWindows,
  onClose,
  onDelete,
}: {
  file: TinFileMeta
  inUseWindows: string[]
  onClose: () => void
  onDelete: () => Promise<void>
}) {
  const [refs, setRefs] = useState<RefsResult | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getFileRefs(file.name)
      .then(setRefs)
      .catch(() => setRefs(null))
  }, [file.name])

  const blocked = (refs?.referrer_count ?? 0) > 0

  return (
    <Shell title={`삭제 — ${file.name}`} onClose={onClose}>
      {refs ? <RefWarning refs={refs} /> : null}

      {inUseWindows.length > 0 && (
        <div
          className="mb-3 rounded-md border px-3 py-2 leading-relaxed"
          style={{
            borderColor: "rgb(245 165 36 / 0.45)",
            background: "rgb(245 165 36 / 0.12)",
            fontSize: "var(--tin-fs-sm)",
          }}
        >
          <AlertTriangle className="mr-1 inline size-3.5" />
          이 파일은 <b>지금 실행 중인 세션({inUseWindows.join(", ")})</b>이 사용
          중입니다. 지금 당장은 멈추지 않지만 <b>다음 재접속 때 문제가 됩니다.</b>
        </div>
      )}

      <p style={{ fontSize: "var(--tin-fs-sm)" }}>
        진짜로 지우지 않고 <b className="tin-mono">_trash/</b> 폴더로 옮깁니다.
        되돌리려면 서버에서 그 폴더의 파일을 꺼내면 됩니다.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost} style={inputStyle}>
          취소
        </button>
        <button
          disabled={busy || blocked}
          onClick={async () => {
            setBusy(true)
            try {
              await onDelete()
            } finally {
              setBusy(false)
            }
          }}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--destructive)" }}
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          휴지통으로 옮기기
        </button>
      </div>
    </Shell>
  )
}

/** 읽기 전용 배지 */
export function ReadOnlyBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
      style={{
        fontSize: "var(--tin-fs-sm)",
        borderColor: "var(--tin-edge)",
        opacity: 0.85,
      }}
    >
      <Lock className="size-3" />
      읽기 전용 (부팅 파일)
    </span>
  )
}
