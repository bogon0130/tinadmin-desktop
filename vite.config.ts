import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import pkg from "./package.json" with { type: "json" }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 화면 상단 버전 뱃지에 쓴다. package.json 을 번들에 통째로 넣지 않고
  // 빌드 시점에 문자열로 박아 넣는다 (버전을 손으로 적지 않게).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
})
