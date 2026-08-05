import { Fragment, useState, type ReactNode } from "react"
import { Check, Copy } from "lucide-react"

/**
 * 아주 작은 마크다운 렌더러 (참고서 패널용).
 *
 * 라이브러리를 쓰지 않는 이유:
 *  1) 문서가 쓰는 문법이 7종뿐이다 — 제목/표/코드블록/인용문/목록/인라인코드/굵게
 *  2) 보안 — 이 앱은 withGlobalTauri:true + csp:null 이라 페이지 JS가 Tauri API에
 *     접근할 수 있다. HTML 문자열을 dangerouslySetInnerHTML 로 넣으면
 *     <img onerror=...> 같은 주입이 실제로 실행된다.
 *     React 엘리먼트를 직접 만들면 텍스트가 자동 이스케이프되어 주입 경로가 없다.
 *  3) HUD 테마(hud-table / tin-accent / tin-mono)를 그대로 입히기 쉽다
 *
 * 지원하지 않는 문법(링크, 이미지, 중첩 목록 등)은 그냥 평문으로 보인다.
 * 파싱이 애매한 줄은 버리지 않고 문단으로 출력해서 내용이 유실되지 않게 한다.
 */

/**
 * 코드블록 — 오른쪽 위에 복사 버튼을 얹는다.
 *
 * 참고서에 든 건 대부분 tmux/tt++ 명령이라 "읽는 것"보다 "그대로 실행하는 것"이
 * 목적이다. 손으로 옮겨 적다 오타가 나면 엉뚱한 창을 죽일 수 있어서 복사를 붙였다.
 */
function CodeBlock({ text }: { text: string }) {
  const [done, setDone] = useState(false)

  async function copy() {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      // Tauri 웹뷰에서 clipboard API 가 막히면 구형 경로로 시도한다
      try {
        const ta = document.createElement("textarea")
        ta.value = text
        ta.style.position = "fixed"
        ta.style.left = "-9999px"
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand("copy")
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }
    if (ok) {
      setDone(true)
      setTimeout(() => setDone(false), 1200)
    }
  }

  return (
    <div className="md-pre-wrap">
      <pre className="md-pre tin-mono tin-scroll">{text}</pre>
      <button onClick={() => void copy()} className="md-copy" title="복사">
        {done ? <Check className="size-3" /> : <Copy className="size-3" />}
        {done ? "복사됨" : "복사"}
      </button>
    </div>
  )
}

/** 인라인: `코드`, **굵게** 만 처리 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  // `코드` 를 먼저 잘라낸다 (코드 안의 ** 는 굵게로 해석하지 않도록)
  const parts = text.split(/(`[^`]*`)/g)

  parts.forEach((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      out.push(
        <code key={`${keyBase}-c${i}`} className="md-code tin-mono">
          {part.slice(1, -1)}
        </code>,
      )
      return
    }
    // **굵게**
    part.split(/(\*\*[^*]+\*\*)/g).forEach((seg, j) => {
      if (!seg) return
      if (seg.startsWith("**") && seg.endsWith("**") && seg.length > 4) {
        out.push(
          <strong key={`${keyBase}-b${i}-${j}`} className="font-bold">
            {seg.slice(2, -2)}
          </strong>,
        )
      } else {
        out.push(<Fragment key={`${keyBase}-t${i}-${j}`}>{seg}</Fragment>)
      }
    })
  })
  return out
}

/** 표 한 줄을 셀 배열로. 앞뒤 | 를 버리고 가운데만 취한다. */
function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith("|")) s = s.slice(1)
  if (s.endsWith("|")) s = s.slice(0, -1)
  return s.split("|").map((c) => c.trim())
}

const isDivider = (line: string) =>
  /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-")

export function renderMarkdown(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n")
  const out: ReactNode[] = []
  let i = 0
  let key = 0

  // 목록/문단을 모아두는 버퍼
  let listBuf: string[] = []
  let paraBuf: string[] = []

  const flushList = () => {
    if (listBuf.length === 0) return
    const items = [...listBuf]
    listBuf = []
    out.push(
      <ul key={`ul-${key++}`} className="md-ul">
        {items.map((t, n) => (
          <li key={n}>{inline(t, `li-${key}-${n}`)}</li>
        ))}
      </ul>,
    )
  }

  const flushPara = () => {
    if (paraBuf.length === 0) return
    const text = paraBuf.join(" ")
    paraBuf = []
    out.push(
      <p key={`p-${key++}`} className="md-p">
        {inline(text, `p-${key}`)}
      </p>,
    )
  }

  const flushAll = () => {
    flushList()
    flushPara()
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 빈 줄 → 문단/목록 끊기
    if (trimmed === "") {
      flushAll()
      i++
      continue
    }

    // 코드블록 ```
    if (trimmed.startsWith("```")) {
      flushAll()
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        body.push(lines[i])
        i++
      }
      i++ // 닫는 ``` 건너뛰기
      out.push(<CodeBlock key={`pre-${key++}`} text={body.join("\n")} />)
      continue
    }

    // 제목 # / ## / ###
    const h = trimmed.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      flushAll()
      const level = h[1].length
      const text = h[2]
      // 크기/여백/구분선은 CSS(.md-h1~3)가 맡는다. 여기서는 위계만 정한다.
      // div 대신 진짜 제목 태그를 쓰면 화면 낭독기에서도 구조가 읽힌다.
      const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as "h1" | "h2" | "h3"
      out.push(
        <Tag key={`h-${key++}`} className={`md-h${level}`}>
          {inline(text, `h-${key}`)}
        </Tag>,
      )
      i++
      continue
    }

    // 표 — 헤더줄 + 구분선이 연속으로 있을 때만 표로 본다
    if (trimmed.startsWith("|") && i + 1 < lines.length && isDivider(lines[i + 1])) {
      flushAll()
      const head = splitRow(lines[i])
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]))
        i++
      }
      out.push(
        <div key={`tw-${key++}`} className="md-table-wrap tin-scroll">
          <table className="md-table tin-mono">
            <thead>
              <tr>
                {head.map((c, n) => (
                  <th key={n}>{inline(c, `th-${key}-${n}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, rn) => (
                <tr key={rn}>
                  {head.map((_, cn) => (
                    <td key={cn}>{inline(r[cn] ?? "", `td-${key}-${rn}-${cn}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // 인용문 >
    if (trimmed.startsWith(">")) {
      flushAll()
      const body: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        body.push(lines[i].trim().replace(/^>\s?/, ""))
        i++
      }
      out.push(
        <blockquote key={`bq-${key++}`} className="md-quote">
          {inline(body.join(" "), `bq-${key}`)}
        </blockquote>,
      )
      continue
    }

    // 목록 - 또는 *
    const li = trimmed.match(/^[-*]\s+(.*)$/)
    if (li) {
      flushPara()
      listBuf.push(li[1])
      i++
      continue
    }

    // 그 밖의 줄 → 문단으로 모은다 (내용 유실 방지)
    flushList()
    paraBuf.push(trimmed)
    i++
  }

  flushAll()
  return out
}
