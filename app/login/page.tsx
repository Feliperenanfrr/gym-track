"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LogIn } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message
      )
      setLoading(false)
      return
    }
    router.replace("/")
    router.refresh()
  }

  return (
    <main className="flex min-h-[80dvh] flex-col items-center justify-center">
      <div className="rise w-full max-w-sm">
        <p
          className="mb-1 text-center text-[11px] font-semibold tracking-[0.35em] text-ember"
          style={{ fontFamily: "var(--font-condensed)" }}
        >
          SAÚDE · ESTÉTICA · CONDICIONAMENTO
        </p>
        <h1 className="stencil text-center text-5xl text-bone">
          GYM<span className="text-ember">//</span>TRACK
        </h1>
        <div className="hazard mx-auto mt-3 h-1 w-24" />

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-lg border border-seam bg-iron p-5 shadow-[0_2px_18px_rgba(0,0,0,0.35)]"
        >
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
              E-mail
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-seam bg-coal px-3 py-2.5 text-sm text-bone outline-none focus:border-ember"
            />
          </label>
          <label className="mt-4 block">
            <span className="font-mono text-[10px] uppercase tracking-wider text-steel-dim">
              Senha
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-seam bg-coal px-3 py-2.5 text-sm text-bone outline-none focus:border-ember"
            />
          </label>

          {error && (
            <p className="mt-3 rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-ember py-3 text-sm font-bold uppercase tracking-[0.2em] text-coal transition-colors hover:bg-ember-hot disabled:opacity-60"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Entrar
          </button>
        </form>

        <p className="mt-4 text-center font-mono text-[10px] text-steel-dim">
          Acesso restrito — sem cadastro.
        </p>
      </div>
    </main>
  )
}
