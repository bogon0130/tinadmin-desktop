import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, BarChart3, CheckCircle2, FileText, Loader2, Monitor, RefreshCw, XCircle } from "lucide-react"
import { toast } from "sonner"

import { fetchGroups, type CharGroup } from "@/lib/api"

/**
 * 캐릭터 그룹 화면.
 *
 * 어떤 그룹이 어느 tmux 세션의 어느 창으로 떠 있는지, 그 그룹의 tin 파일과
 * 레벨업 통계가 어떻게 붙어 있는지를 한눈에 본다.
 *
 * ★읽기 전용이다★ 이 화면은 tmux 에 아무 명령도 보내지 않는다.
 *   살아있는 창 목록만 조회해서 보여준다.
 */
export function GroupsView() {
  const [groups, setGroups] = useState<CharGroup[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetchGroups()
      setGroups(d.groups)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="tin-scroll min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="tin-accent font-semibold" style={{ fontSize: "var(--tin-fs-sm)" }}>
          캐릭터 그룹
        </span>
        <button
          onClick={() => void load()}
          className="ml-auto flex items-center gap-1 rounded-md border px-2 py-1"
          style={{ borderColor: "var(--tin-edge)", fontSize: "var(--tin-fs-sm)" }}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          새로고침
        </button>
      </div>

      <p className="mb-4" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.7 }}>
        이 화면은 보기만 합니다 — tmux 에 아무 명령도 보내지 않습니다.
      </p>

      {groups.map((g) => (
        <div
          key={g.name}
          className="mb-4 rounded-md border p-3"
          style={{ borderColor: "var(--tin-edge)" }}
        >
          {/* 머리말 */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="tin-accent font-semibold">{g.name}</span>
            <span className="tin-mono rounded px-1.5" style={{ background: "var(--tin-panel2)", fontSize: "var(--tin-fs-sm)" }}>
              tmux: {g.session}
            </span>
            {g.live ? (
              <span className="flex items-center gap-1" style={{ fontSize: "var(--tin-fs-sm)", color: "var(--tin-accent)" }}>
                <CheckCircle2 className="size-3.5" /> 실행 중
              </span>
            ) : (
              <span className="flex items-center gap-1" style={{ fontSize: "var(--tin-fs-sm)", color: "var(--destructive)" }}>
                <XCircle className="size-3.5" /> 세션 없음
              </span>
            )}
            {g.dir && (
              <span className="tin-mono ml-auto" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>
                tin/{g.dir}/
              </span>
            )}
          </div>

          {/* 창 */}
          <p className="hud-sect">
            <Monitor className="mr-1 inline size-3" />
            창 {g.windows.length}개
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {g.windows.map((w) => {
              const up = g.live_windows.includes(w)
              return (
                <span
                  key={w}
                  className="tin-mono rounded border px-2 py-0.5"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    borderColor: up ? "var(--tin-accent)" : "var(--destructive)",
                    color: up ? "var(--tin-accent)" : "var(--destructive)",
                    opacity: up ? 1 : 0.7,
                  }}
                  title={up ? "떠 있음" : "등록돼 있지만 실제로 없음"}
                >
                  {w}
                  {!up && " (없음)"}
                </span>
              )
            })}
          </div>

          {g.extra_windows.length > 0 && (
            <p className="mb-3 flex items-start gap-1" style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.75 }}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                등록되지 않은 창이 이 세션에 떠 있습니다:{" "}
                <b className="tin-mono">{g.extra_windows.join(", ")}</b>
              </span>
            </p>
          )}

          {/* 통계 */}
          <p className="hud-sect">
            <BarChart3 className="mr-1 inline size-3" />
            레벨업 통계
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {g.stats_chars.length === 0 ? (
              <span style={{ fontSize: "var(--tin-fs-sm)", opacity: 0.6 }}>붙어 있는 캐릭터 없음</span>
            ) : (
              g.stats_chars.map((c) => (
                <span
                  key={c.name}
                  className="tin-mono rounded border px-2 py-0.5"
                  style={{
                    fontSize: "var(--tin-fs-sm)",
                    borderColor: "var(--tin-edge)",
                    opacity: c.has_log ? 1 : 0.6,
                  }}
                  title={c.has_log ? "기록이 쌓이고 있음" : "아직 레벨업 기록 없음 (다음 레벨업부터 집계)"}
                >
                  {c.name} {c.has_log ? "· 기록 있음" : "· 기록 대기"}
                </span>
              ))
            )}
          </div>

          {/* 파일 */}
          <p className="hud-sect">
            <FileText className="mr-1 inline size-3" />
            tin 파일 {g.files.length}개
          </p>
          <div className="flex flex-wrap gap-1.5">
            {g.files.map((f) => (
              <span
                key={f}
                className="tin-mono rounded px-1.5"
                style={{ background: "var(--tin-panel2)", fontSize: "var(--tin-fs-sm)" }}
              >
                {f.includes("/") ? f.slice(f.lastIndexOf("/") + 1) : f}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
