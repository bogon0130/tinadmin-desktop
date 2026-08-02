import { describe, expect, test } from "bun:test"

import {
  EMPTY_STORE,
  addFolder,
  allFolders,
  ancestors,
  deleteFolder,
  itemsByFolder,
  moveItem,
  normFolder,
  parseStore,
  removeItem,
  renameFolder,
  upsertItem,
  validName,
  remapFiles,
  allFavoriteFiles,
  type FavStore,
  type Favorite,
} from "./favorites"

function fav(over: Partial<Favorite> = {}): Favorite {
  return {
    id: "f1",
    name: "담신우",
    combo: "담신우조합",
    files: ["기본.tin", "장군/담신우.tin"],
    session: "담신우",
    host: "ggai.tv",
    port: "4000",
    sessionMode: "file",
    mode: "solo",
    folder: "",
    createdAt: "2026-07-31",
    ...over,
  }
}

describe("이름 규칙", () => {
  test("정상 이름 통과", () => {
    for (const n of ["담신우", "장군 조합", "combo_1", "a-b"]) expect(validName(n)).toBeNull()
  })
  test("위험 문자 거부", () => {
    for (const n of ["", "   ", "a;rm", "a$b", 'a"b', "a/b", "가".repeat(31)])
      expect(validName(n)).not.toBeNull()
  })
})

describe("폴더 경로", () => {
  test("정규화", () => {
    expect(normFolder("/a//b/")).toBe("a/b")
    expect(normFolder("  ")).toBe("")
    expect(normFolder("a/b/c/d/e")).toBe("a/b/c") // 최대 3단계
  })
  test("조상", () => {
    expect(ancestors("a/b/c")).toEqual(["a", "a/b", "a/b/c"])
    expect(ancestors("")).toEqual([])
  })
})

describe("깨진 파일 방어", () => {
  test("빈 문자열 -> 빈 목록, 경고 없음", () => {
    const r = parseStore("")
    expect(r.store).toEqual(EMPTY_STORE)
    expect(r.warning).toBeNull()
  })
  test("깨진 JSON -> 빈 목록 + 경고", () => {
    const r = parseStore("{ 이건 JSON 이 아니다")
    expect(r.store.items).toEqual([])
    expect(r.warning).toContain("빈 목록")
  })
  test("배열이 오면 거부", () => {
    expect(parseStore("[1,2,3]").warning).not.toBeNull()
  })
  test("항목 하나가 깨져도 나머지는 살린다", () => {
    const raw = JSON.stringify({
      version: 1,
      folders: ["업무"],
      items: [fav({ id: "ok" }), { name: "이름만있음" }, null, 42],
    })
    const r = parseStore(raw)
    expect(r.store.items.map((i) => i.id)).toEqual(["ok"])
    expect(r.warning).toContain("3개")
  })
  test("항목이 가리키는 폴더가 목록에 없으면 채워 넣는다", () => {
    const raw = JSON.stringify({ version: 1, folders: [], items: [fav({ folder: "a/b" })] })
    expect(parseStore(raw).store.folders).toEqual(["a", "a/b"])
  })
  test("왕복 보존", () => {
    const s = upsertItem(addFolder(EMPTY_STORE, "", "업무") as FavStore, fav({ folder: "업무" }))
    expect(parseStore(JSON.stringify(s)).store).toEqual(s)
  })
})

describe("폴더 만들기/이름변경/삭제", () => {
  test("만들기", () => {
    const s = addFolder(EMPTY_STORE, "", "업무") as FavStore
    expect(s.folders).toEqual(["업무"])
    const s2 = addFolder(s, "업무", "장군") as FavStore
    expect(s2.folders).toEqual(["업무", "업무/장군"])
  })
  test("중복/잘못된 이름 거부", () => {
    const s = addFolder(EMPTY_STORE, "", "업무") as FavStore
    expect(typeof addFolder(s, "", "업무")).toBe("string")
    expect(typeof addFolder(s, "", "a/b")).toBe("string")
  })
  test("4단계는 거부", () => {
    expect(typeof addFolder({ ...EMPTY_STORE, folders: ["a/b/c"] }, "a/b/c", "d")).toBe("string")
  })
  test("이름변경은 하위 폴더와 항목까지 따라간다", () => {
    let s: FavStore = { version: 1, folders: ["업무", "업무/장군"], items: [fav({ folder: "업무/장군" })] }
    s = renameFolder(s, "업무", "사냥") as FavStore
    expect(s.folders).toEqual(["사냥", "사냥/장군"])
    expect(s.items[0].folder).toBe("사냥/장군")
  })
  test("삭제하면 안의 항목은 지워지지 않고 상위로 올라간다", () => {
    const s: FavStore = {
      version: 1,
      folders: ["업무", "업무/장군"],
      items: [fav({ id: "a", folder: "업무/장군" }), fav({ id: "b", folder: "업무" })],
    }
    const r = deleteFolder(s, "업무")
    expect(r.items.map((i) => i.id).sort()).toEqual(["a", "b"]) // 하나도 안 사라짐
    expect(r.items.find((i) => i.id === "a")!.folder).toBe("장군")
    expect(r.items.find((i) => i.id === "b")!.folder).toBe("")
    expect(r.folders).toEqual(["장군"])
  })
})

describe("항목 이동/추가/삭제", () => {
  test("폴더 간 이동", () => {
    const s = moveItem({ version: 1, folders: ["업무"], items: [fav()] }, "f1", "업무")
    expect(s.items[0].folder).toBe("업무")
  })
  test("최상위로 이동", () => {
    const s = moveItem({ version: 1, folders: [], items: [fav({ folder: "업무" })] }, "f1", "")
    expect(s.items[0].folder).toBe("")
  })
  test("추가하면 폴더가 자동 생성된다", () => {
    const s = upsertItem(EMPTY_STORE, fav({ folder: "새폴더/안쪽" }))
    expect(s.folders).toEqual(["새폴더", "새폴더/안쪽"])
  })
  test("같은 id 는 덮어쓴다", () => {
    let s = upsertItem(EMPTY_STORE, fav({ name: "옛이름" }))
    s = upsertItem(s, fav({ name: "새이름" }))
    expect(s.items.length).toBe(1)
    expect(s.items[0].name).toBe("새이름")
  })
  test("삭제", () => {
    expect(removeItem({ version: 1, folders: [], items: [fav()] }, "f1").items).toEqual([])
  })
})

describe("화면용 묶기", () => {
  test("폴더별 항목", () => {
    const s: FavStore = {
      version: 1,
      folders: ["업무"],
      items: [fav({ id: "1", name: "나", folder: "업무" }), fav({ id: "2", name: "가", folder: "업무" }), fav({ id: "3", folder: "" })],
    }
    const m = itemsByFolder(s)
    expect(m.get("업무")!.map((i) => i.name)).toEqual(["가", "나"]) // 가나다 정렬
    expect(m.get("")!.length).toBe(1)
  })
  test("조상 폴더도 목록에 나온다", () => {
    expect(allFolders({ version: 1, folders: ["a/b/c"], items: [] })).toEqual(["a", "a/b", "a/b/c"])
  })
})

describe("접속 방식은 저장 시점에 고정된다", () => {
  test("solo/group 이 보존된다", () => {
    for (const m of ["solo", "group"] as const) {
      const s = upsertItem(EMPTY_STORE, fav({ mode: m }))
      expect(parseStore(JSON.stringify(s)).store.items[0].mode).toBe(m)
    }
  })
  test("모르는 값은 solo 로 떨어진다", () => {
    const raw = JSON.stringify({ version: 1, folders: [], items: [{ ...fav(), mode: "evil" }] })
    expect(parseStore(raw).store.items[0].mode).toBe("solo")
  })
})

describe("옛 경로 고치기 (폴더 이름 변경 후 복구)", () => {
  const store: FavStore = {
    version: 1,
    folders: [],
    items: [
      fav({ id: "a", name: "유원찬", files: ["기본.tin", "장군/유원찬.tin", "직업별_자반/직업_장군.tin"] }),
      fav({ id: "b", name: "한비광", files: ["기본.tin", "한비광.tin"] }),
    ],
  }
  const MAP = {
    "기본.tin": "1_기본/기본.tin",
    "장군/유원찬.tin": "2_장군/유원찬.tin",
    "직업별_자반/직업_장군.tin": "3_직업별_자반/직업_장군.tin",
  }

  test("낡은 경로만 갈아끼운다", () => {
    const { store: next, changed } = remapFiles(store, MAP)
    expect(next.items[0].files).toEqual([
      "1_기본/기본.tin",
      "2_장군/유원찬.tin",
      "3_직업별_자반/직업_장군.tin",
    ])
    // 이미 유효한 한비광.tin 은 그대로
    expect(next.items[1].files).toEqual(["1_기본/기본.tin", "한비광.tin"])
    expect(changed.length).toBe(4)
  })

  test("map 에 없는 경로는 손대지 않는다 (모호/없음)", () => {
    const { store: next, changed } = remapFiles(store, {})
    expect(next.items[0].files).toEqual(store.items[0].files)
    expect(changed).toEqual([])
  })

  test("#read 순서가 보존된다", () => {
    const { store: next } = remapFiles(store, MAP)
    expect(next.items[0].files.length).toBe(3)
    expect(next.items[0].files[0]).toContain("기본")
    expect(next.items[0].files[1]).toContain("유원찬")
  })

  test("이름·세션·접속방식 등 나머지는 안 바뀐다", () => {
    const { store: next } = remapFiles(store, MAP)
    expect(next.items[0].name).toBe("유원찬")
    expect(next.items[0].mode).toBe(store.items[0].mode)
    expect(next.items[0].session).toBe(store.items[0].session)
  })

  test("전체 파일 목록은 중복 없이 모은다", () => {
    expect(allFavoriteFiles(store).sort()).toEqual(
      ["기본.tin", "장군/유원찬.tin", "직업별_자반/직업_장군.tin", "한비광.tin"].sort(),
    )
  })
})
