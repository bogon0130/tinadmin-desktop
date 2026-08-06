import { useCallback, useEffect, useMemo, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

import { comboConnect, comboCreate } from "@/lib/api"
import {
  EMPTY_STORE,
  itemsByFolder,
  loadFavorites,
  saveFavorites,
  type FavStore,
  type Favorite,
} from "@/lib/favorites"

/**
 * 즐겨찾기 시안 4종(S1~S4)이 공유하는 데이터·동작.
 *
 * ★로직을 여기 한 곳에만 둔다★
 *   시안마다 접속 코드를 복사해두면 한쪽만 고쳐지는 사고가 난다. 화면 4개는
 *   배치만 다르고, 무엇을 불러오고 누르면 무슨 일이 나는지는 전부 이 훅이 정한다.
 *
 * 접속 순서는 기존 favorites-panel 과 동일하다:
 *   comboCreate(조합 재생성+검증) -> comboConnect(서버가 ssh 재료 계산)
 *   -> open_terminal(이 PC 가 PowerShell 창을 띄움)
 */

/** 폴더가 없는 항목을 묶어 보여줄 이름 */
export const ROOT_LABEL = "기타"

/** 마지막 접속 시각 — 서버에 없는 값이라 이 PC 에만 남긴다 */
const LAST_KEY = "tinadmin.favLastConnect"

export interface FavGroup {
  folder: string
  label: string
  items: Favorite[]
}

function readLast(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    if (!raw) return {}
    const v = JSON.parse(raw) as unknown
    return typeof v === "object" && v !== null ? (v as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/**
 * 저장된 방식으로 실제 접속한다 — 이 앱에서 접속 순서를 정하는 유일한 함수.
 *
 *   1) comboCreate  조합을 다시 만들어 검증까지 통과시킨다 (실패 시 여기서 멈춤)
 *   2) comboConnect 서버에서 접속 명령 재료를 받는다 (IP/계정은 서버 config/.env)
 *   3) open_terminal 이 PC 가 새 PowerShell 창을 띄운다
 *
 * 훅을 쓸 수 없는 곳(기존 관리 패널)에서도 부를 수 있게 훅 밖에 둔다.
 */
export async function runConnect(f: Favorite) {
  const c = await comboCreate(f.combo, f.files, f.session, f.host, f.port, f.sessionMode)
  const info = await comboConnect(c.combo, c.session, f.mode)
  await invoke<string>("open_terminal", {
    target: info.ssh_target,
    remote: info.remote,
    title: `${f.name} ${modeLabel(f)} — tinadmin`,
  })
  return info
}

export function useFavorites(reloadKey: number) {
  const [store, setStore] = useState<FavStore>(EMPTY_STORE)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [lastConnect, setLastConnect] = useState<Record<string, number>>(() => readLast())

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

  /** 폴더별 묶음. 폴더 없는 항목("기타")은 맨 뒤로. */
  const groups: FavGroup[] = useMemo(() => {
    const byFolder = itemsByFolder(store)
    return [...byFolder.keys()]
      .sort((a, b) => {
        if (a === "") return 1
        if (b === "") return -1
        return a.localeCompare(b, "ko")
      })
      .map((f) => ({
        folder: f,
        label: f || ROOT_LABEL,
        items: byFolder.get(f) ?? [],
      }))
  }, [store])

  const connect = useCallback(async (f: Favorite) => {
    setBusy(f.id)
    try {
      const info = await runConnect(f)
      setLastConnect((prev) => {
        const next = { ...prev, [f.id]: Date.now() }
        try {
          localStorage.setItem(LAST_KEY, JSON.stringify(next))
        } catch {
          /* 기록 실패해도 접속 자체는 됐다 */
        }
        return next
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
  }, [])

  /**
   * 캐릭터 메모 저장 — 해당 항목의 memo 만 바꾸고 나머지 필드는 그대로 둔다.
   *
   * ★서버는 스토어 전체를 통째로 받는다★
   *   그래서 "메모만 보내는" 경량 API 가 따로 없다. 대신 현재 스토어를 복사해
   *   memo 한 칸만 갈아끼워 보낸다 — 다른 항목/필드는 손대지 않는다.
   *   저장에 실패하면 화면을 원래 값으로 되돌린다(낙관적 갱신 + 롤백).
   */
  const saveMemo = useCallback(
    async (id: string, memo: string) => {
      const prev = store
      const next: FavStore = {
        ...store,
        items: store.items.map((x) => (x.id === id ? { ...x, memo } : x)),
      }
      setStore(next)
      try {
        await saveFavorites(next)
        toast.success("메모 저장됨")
        return true
      } catch (e) {
        setStore(prev) // 롤백
        toast.error("메모 저장 실패", {
          description: e instanceof Error ? e.message : String(e),
        })
        return false
      }
    },
    [store],
  )

  return { store, groups, loading, busy, connect, saveMemo, lastConnect, reload: load }
}

/** 시안들이 공통으로 쓰는 표시용 헬퍼 */
export function modeLabel(f: Favorite): string {
  return f.mode === "group" ? "그룹" : "단독"
}
