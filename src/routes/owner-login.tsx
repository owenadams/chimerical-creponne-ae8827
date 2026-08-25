import { createFileRoute, Link, redirect, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { getOwnerAccess, loginOwner } from '@/server/owner-auth.functions'

const ownerLoginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/owner-login')({
  validateSearch: ownerLoginSearchSchema,
  beforeLoad: async ({ search }) => {
    const auth = await getOwnerAccess()
    if (auth.authenticated) {
      throw redirect({ to: search.redirect ?? '/gmail-assistant' })
    }
  },
  component: OwnerLoginPage,
})

function OwnerLoginPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = useSearch({ from: '/owner-login' })
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return

    setSubmitting(true)
    setError('')
    try {
      await loginOwner({ data: { password } })
      navigate({ to: redirectTo ?? '/gmail-assistant' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-4 transition-colors"
        >
          <span aria-hidden="true">←</span> Owen's Games
        </Link>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🔒</div>
            <h1 className="text-3xl font-black text-white tracking-tight">Owner Access</h1>
            <p className="text-white/65 mt-2 text-sm">Enter your password to unlock this section.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter owner password"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-emerald-400 focus:bg-white/15 transition-all"
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !password.trim()}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/50"
            >
              {submitting ? 'Checking…' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
