import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ExternalLinkGuard } from "./components/external-link-guard.tsx"
import { UpdateChecker } from "./components/update-checker.tsx"

// 항상 다크 테마 (index.css에서 :root/.dark 를 같은 팔레트로 고정)
document.documentElement.classList.add("dark")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ExternalLinkGuard />
    <App />
    <UpdateChecker />
  </StrictMode>,
)
