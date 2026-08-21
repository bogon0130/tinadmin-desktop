import type { GroupDef } from "@/components/groups/group-card"

/**
 * 그룹 6개의 고정 정의 — 메인페이지 카드와 그룹 대시보드 상단 카드가 함께 쓴다.
 *
 * ★한 벌만 둔다★ 원래 main-view.tsx 안에만 있었는데, 그룹 대시보드 상단의
 *   "한방 접속" 칸을 같은 GroupCard 로 바꾸면서 두 화면이 같은 정의를 필요로
 *   하게 됐다. 복사해 두 벌을 두면 한쪽만 고쳐지는 사고가 나므로 여기로 뺐다.
 */

/** 그룹 순서 — 리더 그룹 2개를 먼저, 직업 그룹 4개를 뒤에 */
export const GROUPS: GroupDef[] = [
  {
    name: "한비광",
    session: "goblin",
    files: [
      { label: "기본", path: "tin/한비광그룹/한비광그룹기본.tin" },
      // 이 카드의 "리더" 는 공용 리더.tin 이 아니라 리더 캐릭터 본인의 파일이다.
      { label: "리더", path: "tin/한비광그룹/한비광.tin" },
      // 졸일은 combo 가 없어 원본 직결이다(2026-08-21 쫄그룹에서 편입).
      { label: "졸일", path: "tin/한비광그룹/졸일.tin" },
    ],
  },
  {
    name: "천마신군",
    session: "chunma",
    files: [
      { label: "기본", path: "tin/천마신군그룹/천마그룹기본.tin" },
      { label: "리더", path: "tin/3_직업별_자반/리더.tin" },
    ],
  },
  {
    name: "장군",
    session: "janggun",
    files: [
      { label: "기본", path: "tin/1_기본/기본.tin" },
      { label: "장군", path: "tin/3_직업별_자반/직업_장군.tin" },
      { label: "리더", path: "tin/3_직업별_자반/리더.tin" },
    ],
  },
  {
    name: "대부",
    session: "daebu",
    files: [
      { label: "기본", path: "tin/1_기본/기본.tin" },
      { label: "대부", path: "tin/3_직업별_자반/직업_대부.tin" },
      { label: "리더", path: "tin/3_직업별_자반/리더.tin" },
    ],
  },
  {
    // 교황·마왕에는 리더 줄이 없다 — 대신 직업 버프 자반이 붙는다.
    name: "교황",
    session: "gyohwang",
    files: [
      { label: "기본", path: "tin/1_기본/기본.tin" },
      { label: "교황", path: "tin/3_직업별_자반/직업_교황.tin" },
      { label: "교황버프", path: "tin/3_직업별_자반/직업_교황_버프.tin" },
    ],
  },
  {
    name: "마왕",
    session: "mawang",
    files: [
      { label: "기본", path: "tin/1_기본/기본.tin" },
      { label: "마왕", path: "tin/3_직업별_자반/직업_마왕.tin" },
      { label: "마왕버프", path: "tin/3_직업별_자반/직업_마왕_버프.tin" },
    ],
  },
]

/**
 * 세션 이름으로 그룹 정의를 찾는다.
 *
 * ★이름이 아니라 세션으로 찾는 이유★ 대시보드가 쓰는 이름은 "한비광그룹"인데
 *   여기 정의된 이름은 "한비광" 이라 서로 다르다. 세션(goblin/chunma/...)은
 *   config.py GROUPS 와 여기가 같은 값을 쓰므로 이쪽이 안전하다.
 */
export function groupDefBySession(session: string): GroupDef | undefined {
  return GROUPS.find((g) => g.session === session)
}
