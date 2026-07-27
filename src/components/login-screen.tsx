import { useState } from "react"
import { Loader2, Terminal } from "lucide-react"

import { DEFAULT_API_URL, getApiUrl, login, setApiUrl } from "@/lib/api"

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState("")
  const [url, setUrl] = useState(getApiUrl())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      setApiUrl(url)
      await login(password)
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Terminal className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">tinadmin</h1>
            <p className="text-xs text-muted-foreground">
              고블린 tt++ 자반 관리자
            </p>
          </div>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          서버 주소
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={DEFAULT_API_URL}
          spellCheck={false}
          className="font-mono-tin mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />

        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          비밀번호
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />

        {error && (
          <div className="mb-4 whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          접속
        </button>
      </form>
    </div>
  )
}
