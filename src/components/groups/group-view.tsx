import { GroupDashboard } from "@/components/groups/group-dashboard"

/** 그룹 화면 셸 — 대시보드만 렌더한다. */
export function GroupView({ groupName }: { groupName: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GroupDashboard groupName={groupName} />
    </div>
  )
}
