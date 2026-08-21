import { GroupDashboard } from "@/components/groups/group-dashboard"

/** 그룹 화면 셸 — 대시보드만 렌더한다. */
export function GroupView({
  groupName,
  onOpenFile,
}: {
  groupName: string
  /** 카드의 "파일보기" 가 파일관리 화면을 여는 통로 (App.tsx 가 넘긴다). */
  onOpenFile: (name: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GroupDashboard groupName={groupName} onOpenFile={onOpenFile} />
    </div>
  )
}
