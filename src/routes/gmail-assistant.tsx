import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { getOwnerAccess, logoutOwner } from '@/server/owner-auth.functions'

export const Route = createFileRoute('/gmail-assistant')({
  beforeLoad: async () => {
    const auth = await getOwnerAccess()
    if (!auth.authenticated) {
      throw redirect({ to: '/owner-login' })
    }
  },
  component: GmailAssistantPage,
})

function GmailAssistantPage() {
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logoutOwner()
    navigate({ to: '/owner-login' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 p-4 py-10 sm:py-14">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
          >
            <span aria-hidden="true">←</span> Owen's Games
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-sm font-semibold text-white/90 bg-white/10 hover:bg-white/15 border border-white/20 px-3.5 py-2 rounded-lg transition-all disabled:opacity-60"
          >
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 sm:p-8">
          <div className="mb-7">
            <div className="text-5xl mb-3">📬</div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Gmail Assistant</h1>
            <p className="text-emerald-200 mt-2 text-sm sm:text-base">
              Private owner workspace for reviewing, drafting, and organizing email tasks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/15 bg-white/5 p-4">
              <h2 className="text-white font-semibold mb-1.5">Inbox Triage</h2>
              <p className="text-white/65 text-sm">Surface priority messages and suggested next actions.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-4">
              <h2 className="text-white font-semibold mb-1.5">Draft Support</h2>
              <p className="text-white/65 text-sm">Create reply drafts quickly from short prompts.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-4">
              <h2 className="text-white font-semibold mb-1.5">Daily Workflow</h2>
              <p className="text-white/65 text-sm">Track recurring follow-ups and summarize progress.</p>
            </div>
          </div>

          <p className="text-white/45 text-xs mt-6">
            This area is password protected and intended for owner-only access.
          </p>
        </div>
      </div>
    </div>
  )
}
