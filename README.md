# tinadmin-desktop

고블린 머드 tt++ 자반 관리자(tinadmin)의 **데스크톱 앱**.
서버에서 돌아가는 tinadmin Flask API에 붙어서 `.tin` 설정을 편집한다.

- 서버측 API: `https://tin.bogon.kr` (또는 내부망 `http://192.168.219.157:5050`)
- 기술: Tauri 2 + React + TypeScript + Vite + shadcn/ui

---

## 1. 프로그램(.exe) 다운로드 — 그냥 쓰기만 할 때

빌드할 필요 없이 **GitHub Releases에서 설치본을 받으면 된다.**

1. https://github.com/bogon0130/tinadmin-desktop/releases 접속
2. 최신 버전(예: `v0.1.0`) 항목의 **Assets** 펼치기
3. Windows용 파일 받기:
   - `...-setup.exe` → **일반 설치 프로그램 (이걸 받으면 됨)**
   - `..._x64_en-US.msi` → 기업/자동배포용 설치 패키지 (같은 앱, 형식만 다름)
4. 받은 `.exe` 실행 → 설치 → 시작메뉴에서 실행

> ⚠️ 서명(코드 사이닝)을 안 해서 처음 실행할 때 Windows가
> "Windows의 PC 보호" 파란 경고창을 띄운다.
> **추가 정보 → 실행** 을 누르면 정상 실행된다.

---

## 2. 개발 모드로 실행하기 (코드 고치면서 볼 때)

Windows/macOS 등 **화면이 있는 PC**에서만 가능하다.
(서버는 헤드리스라 GUI 앱을 띄울 수 없음)

```bash
# 1) 사전 준비 (최초 1회)
#    - Rust:  https://rustup.rs
#    - Bun:   https://bun.sh
#    - Windows면 "Microsoft C++ Build Tools" 도 필요

# 2) 소스 받기
git clone https://github.com/bogon0130/tinadmin-desktop.git
cd tinadmin-desktop

# 3) 의존성 설치
bun install

# 4) 개발 모드 실행 (코드 고치면 화면이 바로 갱신됨)
bun run tauri dev
```

프론트엔드만 브라우저에서 빠르게 보고 싶으면:
```bash
bun run dev        # http://localhost:1420
```

---

## 3. 내 PC에서 직접 빌드하기

```bash
bun run tauri build
```

만들어진 파일 위치 (Windows 기준):
```
src-tauri/target/release/bundle/nsis/*-setup.exe    ← 설치 프로그램
src-tauri/target/release/bundle/msi/*.msi            ← MSI 패키지
```

> ❗ **리눅스 서버에서는 Windows용 .exe를 만들 수 없다.**
> Tauri는 플랫폼별 네이티브 빌드 방식이라, `.exe`는 Windows에서 빌드하거나
> 아래 GitHub Actions(windows-latest 러너)를 써야 한다.
> 실제로 이 프로젝트의 서버(헤드리스 리눅스)에서는 GUI 라이브러리
> (`pkg-config`, `webkit2gtk` 등)가 없어 빌드가 불가능하다.

---

## 4. 새 버전 배포하기 (GitHub Actions 자동 빌드)

이 리포에는 `.github/workflows/release.yml`이 들어있어서,
**버전 태그를 올리면 GitHub이 알아서 Windows/macOS/Linux 빌드를 만들어
Releases에 올려준다.** 내 PC에 개발환경이 없어도 된다.

### 배포 순서

```bash
# 1) 버전 번호 올리기 — 아래 3개 파일의 version을 똑같이 맞출 것
#    - package.json
#    - src-tauri/tauri.conf.json   ← 이게 릴리즈 태그 이름의 기준이 됨
#    - src-tauri/Cargo.toml

# 2) 커밋
git add -A
git commit -m "chore: v0.2.0"
git push

# 3) 태그 올리기 → 이 순간 자동 빌드 시작
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

### 진행 상황 보기
- https://github.com/bogon0130/tinadmin-desktop/actions
- 빌드는 보통 **10~20분** 걸린다 (Windows/macOS Intel/macOS Apple Silicon/Linux 4개를 동시에 만듦)
- 다 끝나면 https://github.com/bogon0130/tinadmin-desktop/releases 에
  `.exe`, `.msi`, `.dmg`, `.deb`, `.AppImage` 가 자동으로 올라간다

### 수동으로 빌드 돌리기
태그를 안 만들고도 Actions 탭 → **Release** 워크플로우 →
**Run workflow** 버튼으로 직접 실행할 수 있다.

### 태그 이름 규칙 (중요)
워크플로우가 `src-tauri/tauri.conf.json`의 `version` 값을 읽어서
`v<버전>` 이름으로 릴리즈를 만든다.
**태그 이름과 tauri.conf.json 버전이 다르면 릴리즈가 엉뚱한 이름으로 생기니**
반드시 맞출 것. (예: tauri.conf.json이 `0.2.0`이면 태그도 `v0.2.0`)

---

## 5. 폴더 구조

```
tinadmin-desktop/
├── src/                    React 프론트엔드 (화면)
│   ├── components/         UI 컴포넌트 (shadcn/ui)
│   └── lib/
├── src-tauri/              Tauri 네이티브 셸 (Rust)
│   ├── src/                Rust 코드
│   ├── icons/              앱 아이콘
│   ├── Cargo.toml          Rust 의존성 + 버전
│   └── tauri.conf.json     ★앱 설정 (이름/창크기/버전/번들)★
├── .github/workflows/
│   └── release.yml         GitHub Actions 자동 빌드 설정
└── package.json            프론트엔드 의존성 + 버전
```

---

## 6. 현재 상태

- [x] Tauri + shadcn/ui 스캐폴딩
- [x] GitHub Actions 릴리즈 워크플로우 (Windows/macOS/Linux)
- [x] 로그인 화면 + 서버 주소 설정
- [x] 사이드바 12개 화면 (자반/줄임말/변수/치환/하이라이트/가그/매크로/타이머/클래스/프리셋/메모/Raw)
- [x] 표: 40px 조밀한 행, monospace, sticky 헤더, 열 정렬, 검색, hover 편집/삭제, 다중선택 일괄 켜고끄기
- [x] 상단 고정 [전체중지] / [되살리기]
- [x] 우측 문법 치트시트

### 켜고 끄기(사용 체크)가 동작하는 방식
`.tin` 파일에는 원래 "비활성" 개념이 없다. 그래서 항목을 끄면
`#nop [OFF] #action {..} {..}` 형태의 **주석으로 바꿔서** 저장하고,
다시 켜면 원래 명령으로 되돌린다. 꺼진 항목도 해당 탭에 흐리게 계속 보인다.

### 로그인 방식 (중요)
데스크톱 앱은 `http://tauri.localhost` 라는 다른 오리진에서 돌기 때문에
Flask 세션 쿠키(SameSite 기본 Lax)가 크로스 오리진 요청에 실리지 않는다.
그래서 서버(tinadmin)에 **Bearer 토큰 인증**을 추가했고, 앱은 로그인 시 받은
토큰을 저장해서 `Authorization` 헤더로 보낸다.
→ **서버가 이 토큰 기능이 있는 최신 버전이어야 앱이 로그인된다.**

---

## 7. 참고

- 서버측 API 구현: `~/projects/goblin/tinadmin/` (Flask, pm2로 상시 가동)
- 서버 API 문서: `~/projects/goblin/tinadmin/README.md`
- 프로젝트 전체 개요: `~/projects/goblin/docs/00_개요.md`
