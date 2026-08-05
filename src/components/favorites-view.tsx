import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, PlugZap, Settings2, Star } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

import { comboConnect, comboCreate } from "@/lib/api"
import {
  EMPTY_STORE,
  itemsByFolder,
  loadFavorites,
  type FavStore,
  type Favorite,
} from "@/lib/favorites"
import { FavoritesPanel } from "@/components/favorites-panel"
import { QuickFavoritesPanel } from "@/components/quick-favorites-panel"

/**
 * 즐겨찾기 — 디자인 시안 비교용 화면.
 *
 * 4스타일(S1~S4)이 같은 데이터·같은 기능을 쓰고 겉모양만 달라진다.
 * 목록/그리드 전환, 요약 카드 표시 여부는 전부 index.css 의
 * :root[data-ui-style=...] 규칙이 정한다 — 여기서 분기하지 않는다.
 * 그래야 스타일이 늘어도 이 파일은 그대로다.
 *
 * ★접속은 기존과 완전히 같은 순서다★
 *   comboCreate(조합 재생성+검증) -> comboConnect(서버가 ssh 재료 계산)
 *   -> open_terminal(이 PC 가 PowerShell 창을 띄움).
 *   서버 config 의 SSH_HOST(ssh.bogon.kr)를 그대로 탄다.
 */

const ROOT_LABEL = "기타"

export function FavoritesView({ reloadKey }: { reloadKey: number }) {
  const [store, setStore] = useState<FavStore>(EMPTY_STORE)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  /** 폴더 관리·빠른 추가 등 기존 도구 — 평소엔 접어둔다 */
  const [tools, setTools] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { store: s, warning } = await loadFavorites()
      setStore(s)
      if (warning) toast.warning("즐겨찾기", { description: warning })
    } catch (e) {
      toast.error("즐겨찾기를 불러오지 못했습니다", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  /** 폴더 -> 항목. 폴더가 없는 항목은 "기타" 로 모은다. */
  const groups = useMemo(() => {
    const byFolder = itemsByFolder(store)
    const names = [...byFolder.keys()].sort((a, b) => {
      if (a === "") return 1 // 기타는 맨 뒤
      if (b === "") return -1
      return a.localeCompare(b, "ko")
    })
    return names.map((f) => ({
      folder: f,
      label: f || ROOT_LABEL,
      items: byFolder.get(f) ?? [],
    }))
  }, [store])

  /** 저장된 방식으로 즉시 접속 — favorites-panel 과 같은 호출 순서 */
  async function connect(f: Favorite) {
    setBusy(f.id)
    try {
      const c = await comboCreate(f.combo, f.files, f.session, f.host, f.port, f.sessionMode)
      const info = await comboConnect(c.combo, c.session, f.mode)
      await invoke<string>("open_terminal", {
        target: info.ssh_target,
        remote: info.remote,
        title: `${f.name} ${f.mode === "group" ? "그룹" : "단독"} — tinadmin`,
      })
      toast.success(`🖥️ ${f.name} 접속 (${f.mode === "group" ? "그룹" : "단독"})`, {
        description: info.description,
      })
    } catch (e) {
      toast.error(`${f.name} 접속 실패`, {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setBusy(null)
    }
  }

  function toggle(folder: string) {
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto" style={{ padding: "var(--gap-sec)" }}>
      <div className="mx-auto ui-sections" style={{ maxWidth: 1040 }}>
        {/* ---- 화면 제목 ---- */}
        <div className="ui-row">
          <Star className="size-5" style={{ color: "var(--accent)" }} />
          <span className="ty-h">즐겨찾기</span>
          <span className="ty-sub">{store.items.length}개 · 클릭하면 바로 접속합니다</span>
          <button
            onClick={() => setTools((v) => !v)}
            className="ui-btn"
            style={{ marginLeft: "auto" }}
            title="폴더 만들기 · 빠른 추가 · 경로 고치기"
          >
            <Settings2 className="size-4" />
            관리 도구
          </button>
        </div>

        {/* ---- 요약 카드 (S3 대시보드에서만 보인다) ---- */}
        <div className="fav-summary">
          <div className="ui-card">
            <div className="ty-sub">전체</div>
            <div className="ty-num" style={{ color: "var(--accent)" }}>
              {store.items.length}
            </div>
          </div>
          {groups.map((g) => (
            <div key={g.folder} className="ui-card">
              <div className="ty-sub">{g.label}</div>
              <div className="ty-num">{g.items.length}</div>
            </div>
          ))}
        </div>

        {/* ---- 폴더별 목록 ---- */}
        {loading ? (
          <div className="ui-card ui-row">
            <Loader2 className="size-4 animate-spin" />
            <span className="ty-body">불러오는 중…</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="ui-card ty-sub">저장된 즐겨찾기가 없습니다.</div>
        ) : (
          groups.map((g) => {
            const open = !closed.has(g.folder)
            return (
              <section key={g.folder} className="ui-card">
                <button
                  onClick={() => toggle(g.folder)}
                  className="ui-row"
                  style={{ width: "100%", marginBottom: open ? "var(--gap-lg)" : 0 }}
                >
                  {open ? (
                    <ChevronDown className="size-4" style={{ color: "var(--accent)" }} />
                  ) : (
                    <ChevronRight className="size-4" style={{ color: "var(--accent)" }} />
                  )}
                  <span className="ty-sec">{g.label}</span>
                  <span className="ty-sub">{g.items.length}</span>
                </button>

                {open && (
                  <div className="fav-items">
                    {g.items.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => void connect(f)}
                        disabled={busy !== null}
                        className="fav-item"
                        title={`${f.mode === "group" ? "그룹" : "단독"} 접속 — ${f.combo}.tin`}
                      >
                        {busy === f.id ? (
                          <Loader2 className="size-4 shrink-0 animate-spin" />
                        ) : (
                          <PlugZap className="size-4 shrink-0" style={{ color: "var(--accent)" }} />
                        )}
                        <span className="ty-med min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="ty-sub shrink-0">
                          {f.mode === "group" ? "그룹" : "단독"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )
          })
        )}

        {/* ---- 기존 관리 도구 — 접어둔다.
               폴더 만들기/이름변경/드래그 이동, 빠른 추가(로스터), 경로 고치기,
               .bat 내려받기 같은 기능이 전부 여기 들어 있다. ---- */}
        {tools && (
          <div className="ui-sections">
            <FavoritesPanel reloadKey={reloadKey} />
            <QuickFavoritesPanel />
          </div>
        )}
      </div>
    </div>
  )
}
