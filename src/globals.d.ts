/**
 * 빌드 시점에 vite 가 박아 넣는 값들 (vite.config.ts 의 define).
 *
 * package.json 의 version 을 그대로 가져온다 — 화면에 버전을 손으로 적으면
 * 올리는 걸 잊어서 실제와 다른 번호가 표시된다.
 */
declare const __APP_VERSION__: string
