import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import {
  AlertTriangle,
  Zap,
  FilePlus2,
  FolderPlus,
  FolderInput,
  Folder,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { applyCheck, applyNow, type ApplyCheck } from "@/lib/api"

import {
  createDir,
  createTinFile,
  deleteDir,
  deleteTinFile,
  dirRename,
  dirRenameCheck,
  listTinTree,
  moveCheck,
  moveTinFile,
  readParsed,
  readTinFile,
  renameTinFile,
  saveParsed,
  saveTinFile,
  type ParsedFile,
  type TinFileContent,
  type MoveCheck,
  type TinFileMeta,
} from "@/lib/api"
import { EntryTable } from "@/components/entry-table"
import { TYPE_META } from "@/lib/tin-utils"
import type { TableType } from "@/lib/types"
import {
  CreateDialog,
  DeleteDialog,
  ReadOnlyBadge,
  RenameDialog,
} from "@/components/file-dialogs"
import {
  SNIPPET_FORMS,
  insertSnippet,
  type SnippetForm,
} from "@/lib/snippets"
import { SnippetFormDialog } from "@/components/snippet-form"
import { MoveWarnDialog } from "@/components/move-dialog"
import { MovePickerDialog } from "@/components/move-picker"
import { planMove } from "@/lib/move-utils"

/** 실행 중 세션이 쓰는 파일 → 창 이름 (서버 config.FILE_TARGETS 와 같은 내용) */
const IN_USE = new Map<string, string[]>([
  ["한비광.tin", ["한비광"]],
  ["담화린.tin", ["담화린"]],
  ["최상희.tin", ["최상희"]],
  ["초운현.tin", ["초운현"]],
  ["복병.tin", ["복병"]],
  ["공용.tin", ["한비광", "담화린", "최상희", "초운현"]],
  ["stats.tin", ["한비광", "담화린", "최상희"]],
  ["발석차.tin", ["복병"]],
])

function fmtSize(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}

const GROUP_TABS = ["천마신군그룹", "한비광그룹", "쫄그룹", "기본설정그룹"] as const
type GroupTab = (typeof GROUP_TABS)[number]

/**
 * 폴더 경로(dir, 최상위 파일은 "") -> 그룹 탭.
 *
 * 실제 tin/ 폴더명이 "천마신군그룹"/"한비광그룹"/"쫄그룹" 그대로라 그 접두사로만
 * 가른다. 그 셋에 안 속하는 나머지 전부(1_기본/2_교황/2_대부/2_마왕/2_장군/
 * 3_직업별_자반/_combos/stats/최상위 낱개 파일)는 "기본설정그룹"으로 묶는다
 * — 애매한 파일은 없었다(0단계 조사에서 실측 확인).
 *
 * 쫄그룹은 2026-08-15 추가. 그 폴더에는 combo 하위폴더가 없고 졸이~졸육.tin 5개만
 * (졸일은 2026-08-21 에 한비광그룹 폴더로 옮겨졌다)
 * 있다(쫄은 tin 하나로 완결돼 조합 파일을 안 쓴다).
 */
function groupOfDir(dir: string): GroupTab {
  if (dir === "천마신군그룹" || dir.startsWith("천마신군그룹/")) return "천마신군그룹"
  if (dir === "한비광그룹" || dir.startsWith("한비광그룹/")) return "한비광그룹"
  if (dir === "쫄그룹" || dir.startsWith("쫄그룹/")) return "쫄그룹"
  return "기본설정그룹"
}

/** 그룹의 "루트" dir — 그룹 이름과 같은 폴더(천마/한비광/쫄)거나 최상위("", 기본설정그룹). */
function groupRootDir(g: GroupTab): string {
  if (g === "천마신군그룹") return "천마신군그룹"
  if (g === "한비광그룹") return "한비광그룹"
  if (g === "쫄그룹") return "쫄그룹"
  return ""
}

/**
 * tin 파일 관리 (1단계: 읽기 + 편집/저장).
 *
 * ★저장해도 게임 세션에는 반영되지 않는다★
 *   서버의 /api/files/save 는 tmux 로 #read 를 보내지 않는다.
 *   실행 중인 사냥 자반이 저장 즉시 바뀌는 사고를 막기 위한 의도된 동작이고,
 *   실시간 반영은 나중에 별도 "적용" 기능으로 만든다.
 */
export function FilesView({ openFile }: { openFile?: string | null }) {
  const [files, setFiles] = useState<TinFileMeta[]>([])
  const [dirs, setDirs] = useState<string[]>([])
  // [새 파일] 을 누를 때 어느 폴더에 만들지 ('' = 최상위)
  const [targetDir, setTargetDir] = useState("")
  // 드래그 중인 파일 / 드롭 대상 폴더 하이라이트
  const [dragFile, setDragFile] = useState<string | null>(null)
  const [dropDir, setDropDir] = useState<string | null>(null)
  // 참조당하는 파일을 옮기려 할 때 뜨는 경고
  const [moveWarn, setMoveWarn] = useState<{ check: MoveCheck; to: string } | null>(null)
  // 드래그가 안 되는 환경을 위한 폴더 선택 팝업
  const [movePick, setMovePick] = useState<string | null>(null)
  const [current, setCurrent] = useState<TinFileContent | null>(null)
  const [draft, setDraft] = useState("")
  const [loadingList, setLoadingList] = useState(true)
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [dialog, setDialog] = useState<"create" | "rename" | "delete" | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  // textarea 를 한 번이라도 눌렀는지. selectionStart=0(진짜 맨앞 클릭)과
  // "아직 포커스한 적 없음"을 구분하기 위해 따로 추적한다.
  const touchedRef = useRef(false)
  // 열려 있는 양식 폼
  const [snipForm, setSnipForm] = useState<SnippetForm | null>(null)
  // DOM 커밋 직후 복원할 커서 위치 (useLayoutEffect 가 처리)
  const [restoreSel, setRestoreSel] = useState<[number, number] | null>(null)
  // 삽입 직전 textarea 스크롤 위치 (삽입 후 그대로 되돌린다)
  const scrollRef = useRef<number | null>(null)
  // [원문] / [표] 탭
  const [tab, setTab] = useState<"raw" | "table">("raw")
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [tableType, setTableType] = useState<TableType>("action")
  const [tableDirty, setTableDirty] = useState(false)
  const [tableSaving, setTableSaving] = useState(false)
  // 파일 트리 위 그룹 탭 — 기본은 천마신군그룹
  const [groupTab, setGroupTab] = useState<GroupTab>("천마신군그룹")
  // 2단(폴더) 선택 — null 이면 "아직 안 골랐다"(하위 폴더가 있는 그룹의 기본 상태).
  // 하위 폴더가 없는 그룹은 렌더 시점에 자동으로 그룹 루트를 쓴다(폴더 단 자체를 생략).
  const [selectedDir, setSelectedDir] = useState<string | null>(null)

  const dirty = current !== null && draft !== current.content
  const meta = files.find((f) => f.name === current?.name) ?? null
  const readOnly = meta?.read_only ?? false

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      const t = await listTinTree()
      setFiles(t.files)
      setDirs(t.dirs)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const open = useCallback(
    async (name: string) => {
      if (dirty && !confirm("저장하지 않은 변경이 있습니다. 그래도 열까요?")) return
      setLoadingFile(true)
      setConflict(false)
      try {
        const f = await readTinFile(name)
        setCurrent(f)
        setDraft(f.content)
        setParsed(null)
        setTableDirty(false)
        setTab("raw")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      } finally {
        setLoadingFile(false)
      }
    },
    [dirty],
  )

  /** 표 탭으로 전환 — 필요하면 파싱해서 받아온다 */
  async function openTable() {
    if (!current) return
    setTab("table")
    if (parsed && parsed.name === current.name) return
    try {
      setParsed(await readParsed(current.name))
      setTableDirty(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      setTab("raw")
    }
  }

  /** 표에서 편집한 내용 저장 — #read 는 안 나간다 */
  async function handleSaveTable() {
    if (!parsed) return
    setTableSaving(true)
    try {
      const res = await saveParsed(parsed.name, parsed.entries, parsed.mtime_raw)
      toast.success(`✅ 파일 저장됨 — ${res.name}`, {
        description: `백업: ${res.backup ?? "없음"}\n⚠️ 게임엔 미반영 (다음 재접속 때 적용)`,
      })
      // 저장 후 최신 mtime 으로 갱신 + 원문 탭도 다시 읽어둔다
      setParsed(await readParsed(parsed.name))
      setTableDirty(false)
      const f = await readTinFile(parsed.name)
      setCurrent(f)
      setDraft(f.content)
      await loadList()
    } catch (e) {
      const err = e as Error & { status?: number }
      toast.error(
        err.status === 409 ? "다른 곳에서 이 파일이 바뀌었습니다" : "저장 실패",
        {
          description:
            err.status === 409
              ? "표 탭을 다시 열어 최신 내용을 받아주세요."
              : err.message,
        },
      )
    } finally {
      setTableSaving(false)
    }
  }

  // 캐릭터 그룹 화면에서 tin 링크를 눌러 넘어온 경우 그 파일을 자동으로 연다.
  // 이미 그 파일이 열려 있으면 아무것도 안 한다(편집 중이던 내용을 지키기 위해).
  const openedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!openFile) return
    if (openedRef.current === openFile) return
    if (current?.name === openFile) {
      openedRef.current = openFile
      return
    }
    openedRef.current = openFile
    void open(openFile)
  }, [openFile, open, current?.name])

  /** 완성된 tin 줄을 커서 위치에 삽입 */
  function insert(snippetText: string) {
    const ta = taRef.current
    // 한 번도 안 눌렀으면 맨끝. 눌렀으면 그 커서 위치를 그대로 쓴다.
    // (버튼에 onMouseDown preventDefault 를 걸어 포커스를 안 뺏기므로 값이 살아있다)
    const selStart = ta && touchedRef.current ? ta.selectionStart : draft.length
    const selEnd = ta && touchedRef.current ? ta.selectionEnd : draft.length
    const r = insertSnippet(draft, selStart, selEnd, snippetText)
    // ★스크롤 위치를 값 바꾸기 전에 찍어둔다★
    //   controlled textarea 는 value 가 바뀌면 커서뿐 아니라 scrollTop 도 리셋된다.
    //   파일 중간에 삽입하면 화면이 맨 위로 튀어 매번 다시 내려야 했다.
    //   삽입은 커서가 있는 줄 '끝'에서 일어나므로 위쪽 내용은 그대로다.
    //   따라서 원래 scrollTop 을 그대로 되돌리면 보던 자리에 그대로 머문다.
    scrollRef.current = ta ? ta.scrollTop : 0
    setDraft(r.value)
    // rAF 는 React 커밋 전에 돌 수 있어 복원이 덮어써질 수 있으므로,
    // DOM 커밋 직후 실행이 보장되는 useLayoutEffect 로 복원한다.
    setRestoreSel([r.selStart, r.selEnd])
    setSnipForm(null)
  }

  // 삽입 후 커서 + 스크롤 복원 — DOM 이 새 value 로 갱신된 다음에 실행된다
  useLayoutEffect(() => {
    if (!restoreSel) return
    const el = taRef.current
    if (el) {
      // preventScroll — focus() 는 캐럿을 보이게 하려고 바깥 컨테이너까지
      // 스크롤시킨다. 우리가 직접 위치를 맞출 것이므로 그 동작을 막는다.
      el.focus({ preventScroll: true })
      el.setSelectionRange(restoreSel[0], restoreSel[1])

      const want = scrollRef.current
      if (want !== null) {
        el.scrollTop = want
        // 브라우저가 캐럿을 보이려고 한 번 더 움직이는 경우가 있어,
        // 다음 프레임에 한 번 더 맞춘다. 그래도 캐럿이 화면 밖이면
        // (삽입 줄이 아래끝이었던 경우) 최소한만 내려 캐럿을 보이게 한다.
        requestAnimationFrame(() => {
          if (!el.isConnected) return
          if (Math.abs(el.scrollTop - want) > 1) el.scrollTop = want
          scrollRef.current = null
        })
      }
      touchedRef.current = true
    }
    setRestoreSel(null)
  }, [restoreSel])

  /* ---- 바로 적용: 살아있는 창에 #read ---- */
  const [applyInfo, setApplyInfo] = useState<ApplyCheck | null>(null)
  const [applying, setApplying] = useState(false)
  const [riskAck, setRiskAck] = useState(false)

  /** 1단계 — 어디로 나가는지 먼저 보여준다 (아직 전송 안 함) */
  async function askApply() {
    if (!current) return
    try {
      const info = await applyCheck(current.name)
      setApplyInfo(info)
      setRiskAck(false)
    } catch (e) {
      toast.error("적용 대상 확인 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  /** 2단계 — 확인 후 실제 전송 */
  async function doApply() {
    if (!current) return
    setApplying(true)
    try {
      const r = await applyNow(current.name, riskAck)
      setApplyInfo(null)
      if (!r.sent) {
        toast.warning("대상 창이 떠 있지 않습니다", {
          description: "다음 접속 때 적용됩니다.",
        })
        return
      }
      const okCount = r.results.filter((x) => x.ok).length
      const detail = r.results
        .map((x) => `${x.window}: ${x.summary}`)
        .join(" / ")
      if (okCount === r.results.length) {
        toast.success(`⚡ ${r.session} 세션 ${okCount}개 창에 반영됨`, { description: detail })
      } else {
        toast.error(`${r.results.length - okCount}개 창 실패`, { description: detail })
      }
      console.info("[바로 적용]", r)
    } catch (e) {
      toast.error("바로 적용 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setApplying(false)
    }
  }

  async function handleSave() {
    if (!current) return
    setSaving(true)
    try {
      const res = await saveTinFile(current.name, draft, current.mtime_raw)
      setCurrent({ ...current, ...res, content: draft })
      setConflict(false)
      toast.success(`✅ 파일 저장됨 — ${res.name}`, {
        description: `백업: ${res.backup ?? "없음"}\n⚠️ 게임엔 미반영 (다음 재접속 때 적용)`,
      })
      await loadList()
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 409) {
        setConflict(true)
        toast.error("다른 곳에서 이 파일이 바뀌었습니다", {
          description: "다시 불러온 뒤 편집해주세요. (덮어쓰지 않았습니다)",
        })
      } else {
        toast.error("저장 실패", { description: err.message })
      }
    } finally {
      setSaving(false)
    }
  }

  /** 드롭 → 참조 검사 후 이동 (참조 있으면 경고 팝업) */
  async function handleDrop(fileName: string, toDir: string) {
    setDragFile(null)
    setDropDir(null)
    const plan = planMove(fileName, toDir)
    if (plan.skip) return

    try {
      const chk = await moveCheck(fileName)
      if (chk.read_only) {
        toast.error("읽기 전용 파일은 옮길 수 없습니다", { description: chk.name })
        return
      }
      if (chk.referrer_count > 0) {
        setMoveWarn({ check: chk, to: toDir })
        return
      }
      await doMove(fileName, plan.toDir, false)
    } catch (e) {
      toast.error("이동 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function doMove(fileName: string, toDir: string, force: boolean) {
    try {
      const res = await moveTinFile(fileName, toDir, force)
      toast.success(`📦 옮김 — ${res.old_name} → ${res.name}`, {
        description:
          res.ref_warning ?? "⚠️ 게임엔 미반영 (다음 재접속 때 적용)",
      })
      setMoveWarn(null)
      setMovePick(null)
      await loadList()
      // 열려 있던 파일이면 새 경로로 다시 연다
      if (current?.name === fileName) await open(res.name)
    } catch (e) {
      const err = e as Error & { status?: number }
      toast.error("이동 실패", { description: err.message })
    }
  }

  async function handleCreateDir() {
    const name = prompt("새 폴더 이름 (한글·영문·숫자·_·-)")
    if (!name) return
    try {
      const res = await createDir(name.trim())
      toast.success(`📁 폴더 만듦 — ${res.dir}`)
      await loadList()
    } catch (e) {
      toast.error("폴더 만들기 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  /**
   * 폴더 이름 변경.
   *
   * 폴더가 바뀌면 그 안 파일을 가리키던 #read 경로가 전부 깨진다.
   * 그래서 먼저 서버에 물어 몇 곳이 영향받는지 보여주고, 확인을 받은 뒤 진행한다.
   * 서버가 경로를 자동으로 고쳐주고, 실패하면 폴더 이름을 되돌린다.
   */
  async function handleRenameDir(d: string) {
    const cur = d.split("/").pop() ?? d
    const name = prompt(`"${d}" 의 새 이름 (한글·영문·숫자·_·-)`, cur)
    if (name === null) return
    const parent = d.split("/").slice(0, -1).join("/")
    const newDir = parent ? `${parent}/${name.trim()}` : name.trim()
    if (!newDir || newDir === d) return

    try {
      const chk = await dirRenameCheck(d, newDir)
      if (chk.exists) {
        toast.error("이미 같은 이름의 폴더가 있습니다.")
        return
      }
      const msg =
        chk.ref_count > 0
          ? `${d} → ${newDir}\n\n파일 ${chk.files_inside.length}개가 들어 있고, ` +
            `이 폴더를 가리키는 #read 가 ${chk.ref_count}곳 있습니다.\n` +
            `그 경로를 자동으로 고칩니다 (고치기 전 백업).\n\n` +
            chk.refs.map((r) => `  ${r.file}:${r.line}  ${r.raw}`).join("\n") +
            `\n\n진행할까요?`
          : `${d} → ${newDir}\n\n고쳐야 할 #read 는 없습니다. 진행할까요?`
      if (!confirm(msg)) return

      const r = await dirRename(d, newDir)
      toast.success(`📁 ${r.old_dir} → ${r.dir}`, { description: r.note })
      await loadList()
    } catch (e) {
      toast.error("폴더 이름 변경 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function handleDeleteDir(dir: string) {
    if (!confirm(`폴더 '${dir}' 를 지울까요? (빈 폴더만 지워집니다)`)) return
    try {
      await deleteDir(dir)
      toast.success(`📁 폴더 지움 — ${dir}`)
      await loadList()
    } catch (e) {
      toast.error("폴더 삭제 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function handleCreate(name: string) {
    try {
      // 선택한 폴더 안에 만든다
      const full = targetDir ? `${targetDir}/${name}` : name
      const res = await createTinFile(full)
      toast.success(`✅ 새 파일 만듦 — ${res.name}`, {
        description: "⚠️ 게임엔 미반영 (다음 재접속 때 적용)",
      })
      setDialog(null)
      await loadList()
      await open(res.name)
    } catch (e) {
      toast.error("만들기 실패", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function handleRename(newName: string) {
    if (!current) return
    try {
      const res = await renameTinFile(current.name, newName)
      toast.success(`✅ 이름 바꿈 — ${res.old_name} → ${res.name}`, {
        description: `백업: ${res.backup ?? "없음"}\n⚠️ 게임엔 미반영`,
      })
      setDialog(null)
      await loadList()
      await open(res.name)
    } catch (e) {
      const err = e as Error & { status?: number }
      toast.error(
        err.status === 409 ? "참조 중이라 이름을 바꿀 수 없습니다" : "이름 변경 실패",
        { description: err.message },
      )
    }
  }

  async function handleDelete() {
    if (!current) return
    try {
      const res = await deleteTinFile(current.name)
      toast.success(`🗑 휴지통으로 옮김 — ${res.name}`, {
        description: res.in_use_warning ?? "되돌리려면 서버의 _trash 폴더에서 꺼내세요.",
      })
      setDialog(null)
      setCurrent(null)
      setDraft("")
      await loadList()
    } catch (e) {
      const err = e as Error & { status?: number }
      toast.error(
        err.status === 409 ? "참조 중이라 삭제할 수 없습니다" : "삭제 실패",
        { description: err.message },
      )
    }
  }

  // 이 그룹의 진짜 하위 폴더(그룹 루트 자신은 뺀다) — 오름차순
  const rootDir = groupRootDir(groupTab)
  const subfolders = dirs.filter((d) => groupOfDir(d) === groupTab && d !== rootDir).sort()
  // 3단(파일)에 쓸 dir. 하위 폴더가 없는 그룹은 고를 게 없으니 루트를 바로 쓴다
  // (폴더 단 자체가 생략되는 경우). 하위 폴더가 있는 그룹은 사용자가 직접
  // 골라야 한다 — 자동선택 안 함(작업서에서 허용한 선택지).
  const effectiveDir = selectedDir ?? (subfolders.length === 0 ? rootDir : null)
  const filesInDir = effectiveDir === null ? [] : files.filter((f) => (f.dir ?? "") === effectiveDir)

  function selectGroup(g: GroupTab) {
    setGroupTab(g)
    setSelectedDir(null) // 그룹 바꾸면 폴더 선택 초기화 (파일 선택은 current 를 그대로 둔다 — 새 목록에 없으면 강조만 자연히 사라진다)
  }
  function selectDir(d: string) {
    setSelectedDir(d) // 폴더 바꾸면 파일 "선택 강조"는 filesInDir 가 바뀌며 자연히 갱신된다
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 1단: 그룹 탭 + 파일관리 공용 버튼 */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--tin-edge)" }}
      >
        <div className="flex gap-1">
          {GROUP_TABS.map((g) => (
            <button
              key={g}
              onClick={() => selectGroup(g)}
              className="rounded-md border px-3 py-1.5 transition"
              style={{
                fontSize: "var(--tin-fs-sm)",
                borderColor: groupTab === g ? "var(--tin-accent)" : "var(--tin-edge)",
                background: groupTab === g ? "rgb(var(--tin-accent-rgb) / 0.14)" : "transparent",
                color: groupTab === g ? "var(--tin-accent)" : "var(--tin-fg)",
              }}
            >
              {g}
            </button>
          ))}
        </div>
        <span
          className="ml-2"
          style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}
        >
          tin 파일 {files.length}개
        </span>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void handleCreateDir()}
          title="새 폴더 만들기"
          className="ml-auto flex size-6 items-center justify-center rounded hover:bg-[var(--tin-panel2)]"
          style={{ color: "var(--tin-accent)" }}
        >
          <FolderPlus className="size-3.5" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setTargetDir(rootDir); setDialog("create") }}
          title="새 파일 만들기 (현재 그룹 최상위)"
          className="flex size-6 items-center justify-center rounded hover:bg-[var(--tin-panel2)]"
          style={{ color: "var(--tin-accent)" }}
        >
          <FilePlus2 className="size-3.5" />
        </button>
        <button
          onClick={() => void loadList()}
          title="목록 새로고침"
          className="flex size-6 items-center justify-center rounded hover:bg-[var(--tin-panel2)]"
        >
          {loadingList ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </button>
      </div>

      {/* 2단: 하위 폴더 (가로, 없으면 생략) */}
      {subfolders.length > 0 && (
        <div
          className="tin-scroll flex shrink-0 items-center gap-1.5 overflow-x-auto border-b px-3 py-2"
          style={{ borderColor: "var(--tin-edge)" }}
        >
          {/* 그룹 루트 — 그룹 이름과 같은 폴더에 바로 든 파일(있으면)도 여기로 돌아와 볼 수 있다 */}
          <button
            onDragOver={(e) => { e.preventDefault(); setDropDir(rootDir) }}
            onDragLeave={() => setDropDir((p) => (p === rootDir ? null : p))}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.getData("text/plain") || dragFile
              if (f) void handleDrop(f, rootDir)
            }}
            onClick={() => selectDir(rootDir)}
            className="flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5"
            style={{
              fontSize: "var(--tin-fs-sm)",
              borderColor: effectiveDir === rootDir ? "var(--tin-accent)" : (dropDir === rootDir ? "var(--tin-accent)" : "var(--tin-edge)"),
              background: dropDir === rootDir
                ? "rgb(var(--tin-accent-rgb) / 0.18)"
                : effectiveDir === rootDir ? "var(--tin-panel2)" : "transparent",
              color: effectiveDir === rootDir ? "var(--tin-accent)" : "var(--tin-fg)",
            }}
          >
            <Folder className="size-3.5" />
            최상위
          </button>

          {subfolders.map((d) => {
            const items = files.filter((f) => f.dir === d)
            const label = d.slice(d.lastIndexOf("/") + 1)
            return (
              <div
                key={d}
                onDragOver={(e) => { e.preventDefault(); setDropDir(d) }}
                onDragLeave={() => setDropDir((p) => (p === d ? null : p))}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.getData("text/plain") || dragFile
                  if (f) void handleDrop(f, d)
                }}
                className="flex shrink-0 items-center gap-1 rounded-md border pl-2.5 pr-1 py-1"
                style={{
                  fontSize: "var(--tin-fs-sm)",
                  borderColor: dropDir === d
                    ? "var(--tin-accent)"
                    : effectiveDir === d ? "var(--tin-accent)" : "var(--tin-edge)",
                  background: dropDir === d
                    ? "rgb(var(--tin-accent-rgb) / 0.18)"
                    : effectiveDir === d ? "var(--tin-panel2)" : "transparent",
                }}
              >
                <button
                  onClick={() => selectDir(d)}
                  className="flex items-center gap-1 py-0.5"
                  style={{ color: effectiveDir === d ? "var(--tin-accent)" : "var(--tin-fg)" }}
                >
                  <Folder className="size-3.5" />
                  <span className="tin-mono">{label}</span>
                  <span style={{ opacity: 0.7 }}>{items.length}</span>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setTargetDir(d); setDialog("create") }}
                  title={`${d} 안에 새 파일`}
                  className="flex size-5 items-center justify-center rounded hover:bg-[var(--tin-bg)]"
                >
                  <FilePlus2 className="size-3" />
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleRenameDir(d)}
                  title={`${d} 이름 바꾸기`}
                  className="flex size-5 items-center justify-center rounded hover:bg-[var(--tin-bg)]"
                >
                  <Pencil className="size-3" />
                </button>
                {items.length === 0 && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleDeleteDir(d)}
                    title="빈 폴더 지우기"
                    className="flex size-5 items-center justify-center rounded hover:bg-[var(--tin-bg)]"
                    style={{ color: "var(--destructive)" }}
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 3단: 파일 (가로, 넘치면 스크롤) */}
      <div
        className="tin-scroll flex shrink-0 items-center gap-1.5 overflow-x-auto border-b px-3 py-2"
        style={{ borderColor: "var(--tin-edge)" }}
      >
        {effectiveDir === null ? (
          <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>
            위에서 폴더를 먼저 고르세요.
          </span>
        ) : filesInDir.length === 0 ? (
          <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>
            이 폴더엔 파일이 없습니다.
          </span>
        ) : (
          filesInDir.map((f) => {
            const active = current?.name === f.name
            return (
              <button
                key={f.name}
                draggable={!f.read_only}
                onDragStart={(e) => {
                  setDragFile(f.name)
                  e.dataTransfer.effectAllowed = "move"
                  e.dataTransfer.setData("text/plain", f.name)
                }}
                onDragEnd={() => { setDragFile(null); setDropDir(null) }}
                onClick={() => void open(f.name)}
                title={f.read_only ? "읽기 전용 (이동 불가)" : "끌어서 폴더 칩으로 옮길 수 있습니다"}
                className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition"
                style={{
                  borderColor: active ? "var(--tin-accent)" : "var(--tin-edge)",
                  background: active ? "var(--tin-panel2)" : "transparent",
                  opacity: dragFile === f.name ? 0.45 : 1,
                  cursor: f.read_only ? "default" : "grab",
                  fontSize: "var(--tin-fs-sm)",
                }}
              >
                <span
                  className="tin-mono truncate"
                  style={{ color: active ? "var(--tin-accent)" : "var(--tin-fg)", maxWidth: 200 }}
                >
                  {f.base ?? f.name}
                </span>
                {f.has_plain_secret && (
                  <KeyRound className="size-3 shrink-0" style={{ color: "#f5a524" }} />
                )}
                {f.read_only && <Lock className="size-3 shrink-0 opacity-70" />}
              </button>
            )
          })
        )}
      </div>

      {/* 편집기 — 가로 폭 전체 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* 상시 배너 */}
        <div
          className="shrink-0 border-b px-4 py-2 leading-relaxed"
          style={{
            borderColor: "rgb(245 165 36 / 0.35)",
            background: "rgb(245 165 36 / 0.10)",
            fontSize: "var(--tin-fs-sm)",
          }}
        >
          <AlertTriangle
            className="mr-1.5 inline size-3.5"
            style={{ color: "#f5a524" }}
          />
          이 화면의 저장은 <b>파일에만</b> 반영됩니다. 게임 세션에 지금 반영하려면{" "}
          <b>[바로 적용]</b> 을 누르세요 — 그 파일을 읽는 창에만 <b>#read</b> 를 보냅니다.
        </div>

        {/* 바로 적용 — 전송 전 확인 */}
        {applyInfo && (
          <div
            className="mx-3 mb-2 rounded-md border p-3"
            style={{ borderColor: "var(--tin-accent)", background: "var(--tin-panel2)" }}
          >
            <p className="mb-1" style={{ fontSize: "var(--tin-fs-sm)" }}>
              <b className="tin-mono">{applyInfo.name}</b> →{" "}
              <b className="tin-accent">{applyInfo.session}</b> 세션 /{" "}
              <b className="tin-accent">
                {applyInfo.present_windows.join(", ") || "(떠 있는 창 없음)"}
              </b>{" "}
              창에 반영합니다.
            </p>
            {applyInfo.classes.length > 0 && (
              <p style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.8 }}>
                중복 방지: <b className="tin-mono">#class {"{"}{applyInfo.classes.join(", ")}{"}"} kill</b> 후 다시 읽습니다.
              </p>
            )}
            {applyInfo.warning && (
              <p style={{ fontSize: "var(--tin-fs-sm)", color: "#f5a524" }}>⚠️ {applyInfo.warning}</p>
            )}
            {applyInfo.absent_windows.length > 0 && (
              <p style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.8 }}>
                안 떠 있는 창: <b>{applyInfo.absent_windows.join(", ")}</b> — 다음 접속 때 적용됩니다.
              </p>
            )}
            {applyInfo.blocked && (
              <p style={{ fontSize: "var(--tin-fs-sm)", color: "var(--destructive)" }}>
                ⛔ {applyInfo.blocked}
              </p>
            )}

            {/* 위험 상세 — 몇 행에 뭐가 있는지 */}
            {applyInfo.risk_sessions.length > 0 && (
              <div className="mt-1">
                {applyInfo.risk_sessions.map((x) => (
                  <p key={x.line} className="tin-mono" style={{ fontSize: "var(--tin-fs-sm)", color: "var(--destructive)" }}>
                    🔴 {x.line}행 · 재접속 위험 — {x.text}
                  </p>
                ))}
              </div>
            )}
            {applyInfo.risk_bare.length > 0 && (
              <div
                className="mt-2 rounded border p-2"
                style={{ borderColor: "#f5a524" }}
              >
                <p style={{ fontSize: "var(--tin-fs-sm)", color: "#f5a524" }}>
                  ⚠️ 재읽기 시 아래 줄이 <b>그대로 실행</b>돼 캐릭터가 움직일 수 있습니다.
                </p>
                {applyInfo.risk_bare.map((x) => (
                  <p key={x.line} className="tin-mono" style={{ fontSize: "var(--tin-fs-sm)" }}>
                    {x.line}행 · {x.text}
                  </p>
                ))}
                <label className="mt-1 flex cursor-pointer items-center gap-1.5" style={{ fontSize: "var(--tin-fs-sm)" }}>
                  <input
                    type="checkbox"
                    checked={riskAck}
                    onChange={(e) => setRiskAck(e.target.checked)}
                    className="accent-[var(--tin-accent)]"
                  />
                  위 내용을 확인했고, 그래도 반영합니다
                </label>
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => void doApply()}
                disabled={
                  !applyInfo.can_send || applying || (applyInfo.needs_confirm && !riskAck)
                }
                className="flex items-center gap-1 rounded-md border px-3 py-1 disabled:opacity-40"
                style={{ borderColor: "var(--tin-accent)", color: "var(--tin-accent)", fontSize: "var(--tin-fs-sm)" }}
              >
                {applying ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                지금 반영
              </button>
              <button
                onClick={() => setApplyInfo(null)}
                className="rounded-md border px-3 py-1"
                style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {!current ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}
          >
            {loadingFile ? "불러오는 중…" : "왼쪽에서 파일을 선택하세요."}
          </div>
        ) : (
          <>
            {/* 파일 헤더 */}
            <div
              className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2"
              style={{ borderColor: "var(--tin-edge)" }}
            >
              <span className="tin-accent tin-mono font-semibold">
                {current.name}
              </span>
              <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}>
                {fmtSize(current.size)} · 수정 {current.mtime}
              </span>
              {current.has_plain_secret && (
                <span
                  className="rounded-full border px-2 py-0.5"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    borderColor: "#f5a524",
                    color: "#f5a524",
                  }}
                >
                  평문 비번 있음
                </span>
              )}
              {(tab === "table" ? tableDirty : dirty) && (
                <span
                  className="rounded px-2 py-0.5"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    background: "rgb(245 165 36 / 0.18)",
                    color: "#f5a524",
                  }}
                >
                  저장 안 됨
                </span>
              )}
              {readOnly && <ReadOnlyBadge />}


              {/* 바로 적용 — 살아있는 창에 #read */}
              {!readOnly && (
                <button
                  onClick={() => void askApply()}
                  disabled={applying}
                  title="이 파일을 읽는 살아있는 창에 지금 반영합니다"
                  className="flex items-center gap-1 rounded-md border px-2 py-1 disabled:opacity-50"
                  style={{
                    borderColor: "var(--tin-accent)",
                    color: "var(--tin-accent)",
                    fontSize: "var(--tin-fs-sm)",
                  }}
                >
                  {applying ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                  바로 적용
                </button>
              )}

              {/* 원문 / 표 탭 */}
              <div className="flex rounded-md border p-0.5" style={{ borderColor: "var(--tin-edge)" }}>
                {([["raw","원문"],["table","표"]] as const).map(([k, lb]) => (
                  <button
                    key={k}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (k === "table" ? void openTable() : setTab("raw"))}
                    className="rounded px-3 py-1 font-medium transition"
                    style={{
                      fontSize: "var(--tin-fs-sm)",
                      background: tab === k ? "var(--tin-accent)" : "transparent",
                      color: tab === k ? "#06120c" : "var(--tin-fg)",
                    }}
                  >
                    {lb}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                {meta && !readOnly && (
                  <>
                    <button
                      onClick={() => setMovePick(current.name)}
                      title="다른 폴더로 옮기기 (드래그가 안 될 때)"
                      className="flex items-center gap-1 rounded-md border px-2.5 py-1.5"
                      style={{
                        borderColor: "var(--tin-edge)",
                        fontSize: "var(--tin-fs-sm)",
                      }}
                    >
                      <FolderInput className="size-3.5" />
                      이동
                    </button>
                    <button
                      onClick={() => setDialog("rename")}
                      title="이름 바꾸기"
                      className="flex items-center gap-1 rounded-md border px-2.5 py-1.5"
                      style={{
                        borderColor: "var(--tin-edge)",
                        fontSize: "var(--tin-fs-sm)",
                      }}
                    >
                      <Pencil className="size-3.5" />
                      이름
                    </button>
                    <button
                      onClick={() => setDialog("delete")}
                      title="삭제 (휴지통으로)"
                      className="flex items-center gap-1 rounded-md border px-2.5 py-1.5"
                      style={{
                        borderColor: "rgb(255 95 86 / 0.45)",
                        color: "var(--destructive)",
                        fontSize: "var(--tin-fs-sm)",
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      삭제
                    </button>
                  </>
                )}
                <button
                  onClick={() => void open(current.name)}
                  className="rounded-md border px-3 py-1.5"
                  style={{
                    borderColor: "var(--tin-edge)",
                    fontSize: "var(--tin-fs-sm)",
                  }}
                >
                  다시 불러오기
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    tab === "table" ? void handleSaveTable() : void handleSave()
                  }
                  disabled={
                    readOnly ||
                    (tab === "table"
                      ? tableSaving || !tableDirty
                      : saving || !dirty)
                  }
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold disabled:opacity-50"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    background: "var(--tin-accent)",
                    color: "#06120c",
                  }}
                >
                  {saving || tableSaving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  저장
                </button>
              </div>
            </div>

            {/* 충돌 안내 */}
            {conflict && (
              <div
                className="shrink-0 border-b px-4 py-2"
                style={{
                  borderColor: "rgb(255 95 86 / 0.4)",
                  background: "rgb(255 95 86 / 0.12)",
                  fontSize: "var(--tin-fs-sm)",
                }}
              >
                다른 곳에서 이 파일이 바뀌었습니다. <b>다시 불러오세요.</b> 지금
                내용을 저장하면 남의 편집을 덮어쓰게 되어 서버가 거부했습니다.
              </div>
            )}

            {/* 양식 삽입 버튼 — tin 문법을 몰라도 빈칸만 채우면 되게 */}
            {tab === "raw" && !readOnly && (
              <div
                className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-4 py-2"
                style={{ borderColor: "var(--tin-edge)" }}
              >
                <span
                  style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}
                  className="mr-1"
                >
                  양식 넣기
                </span>
                {SNIPPET_FORMS.map((s) => (
                  <button
                    key={s.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSnipForm(s)}
                    title={s.hint}
                    className="rounded-md border px-2.5 py-1 transition hover:border-[var(--tin-accent)]"
                    style={{
                      borderColor: "var(--tin-edge)",
                      fontSize: "var(--tin-fs-sm)",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
                <span
                  className="ml-auto"
                  style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}
                >
                  칸을 채우면 커서 위치에 들어갑니다
                </span>
              </div>
            )}

            {tab === "table" ? (
              !parsed ? (
                <div
                  className="flex flex-1 items-center justify-center"
                  style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}
                >
                  불러오는 중…
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {/* 종류 선택 + raw 안내 */}
                  <div
                    className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-4 py-2"
                    style={{ borderColor: "var(--tin-edge)" }}
                  >
                    {(Object.keys(TYPE_META) as TableType[]).map((t) => {
                      const n = parsed.entries.filter((e) => e.type === t).length
                      return (
                        <button
                          key={t}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setTableType(t)}
                          className="rounded-md border px-2.5 py-1"
                          style={{
                            fontSize: "var(--tin-fs-sm)",
                            borderColor:
                              tableType === t
                                ? "var(--tin-accent)"
                                : "var(--tin-edge)",
                            color:
                              tableType === t
                                ? "var(--tin-accent)"
                                : "var(--tin-fg)",
                            opacity: n === 0 && tableType !== t ? 0.5 : 1,
                          }}
                        >
                          {TYPE_META[t].label.split(" ")[0]}
                          {n > 0 && ` ${n}`}
                        </button>
                      )
                    })}
                    {parsed.raw_count > 0 && (
                      <span
                        className="ml-auto"
                        style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.75 }}
                      >
                        표로 못 쪼개는 항목 {parsed.raw_count}개는{" "}
                        <b>[원문] 탭에서 편집</b>하세요
                      </span>
                    )}
                  </div>

                  {readOnly ? (
                    <div
                      className="flex flex-1 items-center justify-center px-6 text-center leading-relaxed"
                      style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.8 }}
                    >
                      {parsed.name} 은(는) 부팅 진입점이라 읽기 전용입니다.
                      <br />
                      내용은 [원문] 탭에서 볼 수 있습니다.
                    </div>
                  ) : (
                    <EntryTable
                      type={tableType}
                      entries={parsed.entries}
                      onChange={(next) => {
                        setParsed({ ...parsed, entries: next })
                        setTableDirty(true)
                      }}
                    />
                  )}
                </div>
              )
            ) : (
            <textarea
              ref={taRef}
              onMouseUp={() => (touchedRef.current = true)}
              onKeyUp={() => (touchedRef.current = true)}
              onFocus={() => (touchedRef.current = true)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={readOnly}
              spellCheck={false}
              className="tin-mono tin-scroll min-h-0 flex-1 resize-none border-0 p-4 leading-relaxed outline-none"
              style={{
                background: "var(--tin-bg)",
                color: "var(--tin-fg)",
                whiteSpace: "pre",
              }}
            />
            )}
          </>
        )}
      </div>

      {/* 다이얼로그 */}
      {dialog === "create" && (
        <CreateDialog onClose={() => setDialog(null)} onCreate={handleCreate} />
      )}
      {dialog === "rename" && meta && (
        <RenameDialog
          file={meta}
          onClose={() => setDialog(null)}
          onRename={handleRename}
        />
      )}
      {movePick && (
        <MovePickerDialog
          fileName={movePick}
          dirs={dirs}
          onClose={() => setMovePick(null)}
          onPick={(to) => handleDrop(movePick, to)}
        />
      )}

      {moveWarn && (
        <MoveWarnDialog
          check={moveWarn.check}
          toDir={moveWarn.to}
          onClose={() => setMoveWarn(null)}
          onConfirm={() => doMove(moveWarn.check.name, moveWarn.to, true)}
        />
      )}

      {snipForm && (
        <SnippetFormDialog
          form={snipForm}
          onClose={() => setSnipForm(null)}
          onInsert={insert}
        />
      )}

      {dialog === "delete" && meta && (
        <DeleteDialog
          file={meta}
          inUseWindows={IN_USE.get(meta.name) ?? []}
          onClose={() => setDialog(null)}
          onDelete={handleDelete}
        />
      )}

    </div>
  )
}
