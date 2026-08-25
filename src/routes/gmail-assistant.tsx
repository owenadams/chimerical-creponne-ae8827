import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  connectGmailAuth,
  getGmailAuthStatus,
  getGmailLabels,
  getLearningLogUrl,
  getGmailSuggestions,
  processGmailEmails,
  submitGmailFeedback,
} from '@/server/gmail-assistant.functions'
import { getOwnerAccess, logoutOwner } from '@/server/owner-auth.functions'

export const Route = createFileRoute('/gmail-assistant')({
  beforeLoad: async ({ location }) => {
    const auth = await getOwnerAccess()
    if (!auth.authenticated) {
      throw redirect({ to: '/owner-login', search: { redirect: location.href } })
    }
  },
  component: GmailAssistantPage,
})

function GmailAssistantPage() {
  const SYSTEM_LABEL_IDS = useMemo(
    () =>
      new Set([
        'INBOX',
        'SENT',
        'TRASH',
        'SPAM',
        'STARRED',
        'UNREAD',
        'IMPORTANT',
        'CATEGORY_PERSONAL',
        'CATEGORY_SOCIAL',
        'CATEGORY_PROMOTIONS',
        'CATEGORY_UPDATES',
        'CATEGORY_FORUMS',
      ]),
    [],
  )

  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [assistantAuthenticated, setAssistantAuthenticated] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [busyById, setBusyById] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'skipped'>('all')
  const [labels, setLabels] = useState<Array<{ id: string; name: string }>>([])
  const [suggestions, setSuggestions] = useState<Array<SuggestionItem>>([])
  const [editOpenById, setEditOpenById] = useState<Record<string, boolean>>({})
  const [overridesById, setOverridesById] = useState<Record<string, SuggestionOverrideDraft>>({})
  const [bootAttempt, setBootAttempt] = useState(0)

  function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${label} timed out. Please try again.`))
      }, timeoutMs)

      promise
        .then((value) => {
          clearTimeout(timeout)
          resolve(value)
        })
        .catch((err) => {
          clearTimeout(timeout)
          reject(err)
        })
    })
  }

  useEffect(() => {
    let active = true
    const search = new URLSearchParams(window.location.search)
    const oauthStatus = search.get('gmailAuth')
    const oauthReason = search.get('reason')

    if (oauthStatus) {
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.delete('gmailAuth')
      nextUrl.searchParams.delete('reason')
      window.history.replaceState({}, '', nextUrl.toString())
      if (oauthStatus === 'error') {
        setError(oauthReason || 'Gmail OAuth failed')
      }
    }

    async function boot() {
      try {
        const auth = await withTimeout(getGmailAuthStatus(), 20_000, 'Backend status check')
        if (!active) return
        setAssistantAuthenticated(auth.authenticated)
        if (auth.authenticated) {
          const [labelsRes, suggestionsRes] = await withTimeout(
            Promise.all([getGmailLabels(), getGmailSuggestions()]),
            20_000,
            'Gmail data load',
          )
          if (!active) return
          setLabels(labelsRes.labels ?? [])
          setSuggestions((suggestionsRes.suggestions ?? []) as Array<SuggestionItem>)
        }
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load Gmail assistant status')
      } finally {
        if (!active) return
        setAuthLoading(false)
      }
    }

    boot()
    return () => {
      active = false
    }
  }, [bootAttempt])

  const counts = useMemo(() => {
    const total = suggestions.length
    const pending = suggestions.filter((item) => item.status === 'pending').length
    const accepted = suggestions.filter((item) => item.status === 'accepted').length
    const skipped = suggestions.filter((item) => item.status === 'skipped').length
    return { total, pending, accepted, skipped }
  }, [suggestions])

  const filteredSuggestions = useMemo(() => {
    if (filter === 'all') return suggestions
    return suggestions.filter((item) => item.status === filter)
  }, [filter, suggestions])

  const editableLabels = useMemo(
    () => labels.filter((label) => !SYSTEM_LABEL_IDS.has(label.id)),
    [labels, SYSTEM_LABEL_IDS],
  )

  async function handleConnectGmail() {
    setError('')
    try {
      const result = await connectGmailAuth()
      if (result.auth_url) {
        window.location.href = result.auth_url
        return
      }
      setAssistantAuthenticated(true)
      const [labelsRes, suggestionsRes] = await Promise.all([getGmailLabels(), getGmailSuggestions()])
      setLabels(labelsRes.labels ?? [])
      setSuggestions((suggestionsRes.suggestions ?? []) as Array<SuggestionItem>)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gmail connect failed')
    }
  }

  async function handleAnalyze() {
    setProcessing(true)
    setError('')
    try {
      const result = await processGmailEmails({ data: { days: 7, maxResults: 5 } })
      setSuggestions((result.suggestions ?? []) as Array<SuggestionItem>)
      const labelsRes = await getGmailLabels()
      setLabels(labelsRes.labels ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email analysis failed')
    } finally {
      setProcessing(false)
    }
  }

  async function handleOpenLearningLog() {
    setError('')
    try {
      const result = await getLearningLogUrl()
      const dashboardUrl = new URL(result.url)
      dashboardUrl.searchParams.set('t', Date.now().toString())
      window.open(dashboardUrl.toString(), '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open learning log')
    }
  }

  function ensureDraft(item: SuggestionItem) {
    setOverridesById((prev) => {
      if (prev[item.email_id]) return prev
      return {
        ...prev,
        [item.email_id]: {
          action: item.suggestion.action,
          add_label_ids: [...(item.suggestion.add_label_ids ?? [])],
          new_label_name: item.suggestion.new_label_name ?? '',
        },
      }
    })
  }

  function toggleEdit(item: SuggestionItem) {
    ensureDraft(item)
    setEditOpenById((prev) => ({ ...prev, [item.email_id]: !prev[item.email_id] }))
  }

  function setDraftAction(emailId: string, action: SuggestionAction) {
    setOverridesById((prev) => {
      const current = prev[emailId]
      if (!current) return prev
      return { ...prev, [emailId]: { ...current, action } }
    })
  }

  function setDraftNewLabel(emailId: string, newLabelName: string) {
    setOverridesById((prev) => {
      const current = prev[emailId]
      if (!current) return prev
      return { ...prev, [emailId]: { ...current, new_label_name: newLabelName } }
    })
  }

  function toggleDraftLabel(emailId: string, labelId: string) {
    setOverridesById((prev) => {
      const current = prev[emailId]
      if (!current) return prev
      const exists = current.add_label_ids.includes(labelId)
      return {
        ...prev,
        [emailId]: {
          ...current,
          add_label_ids: exists
            ? current.add_label_ids.filter((id) => id !== labelId)
            : [...current.add_label_ids, labelId],
        },
      }
    })
  }

  async function handleFeedback(item: SuggestionItem, accepted: boolean, override?: SuggestionOverridePayload) {
    const emailId = item.email_id
    setBusyById((prev) => ({ ...prev, [emailId]: true }))
    setError('')

    try {
      await submitGmailFeedback({
        data: {
          email_id: emailId,
          accepted,
          suggestion: item.suggestion,
          email: item.email,
          override: override ?? null,
        },
      })

      setSuggestions((prev) => {
        return prev.map((s) => {
          if (s.email_id !== emailId) return s
          if (!accepted) return { ...s, status: 'skipped' }
          if (!override) return { ...s, status: 'accepted' }
          return {
            ...s,
            status: 'accepted',
            suggestion: {
              action: override.action,
              add_label_ids: override.add_label_ids,
              new_label_name: override.new_label_name,
              reason: override.reason,
            },
          }
        })
      })

      if (accepted) {
        setEditOpenById((prev) => ({ ...prev, [emailId]: false }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feedback')
    } finally {
      setBusyById((prev) => ({ ...prev, [emailId]: false }))
    }
  }

  async function handleApplyOverride(item: SuggestionItem) {
    const draft = overridesById[item.email_id]
    if (!draft) return

    const override: SuggestionOverridePayload = {
      action: draft.action,
      add_label_ids: [...new Set(draft.add_label_ids)],
      new_label_name: draft.new_label_name.trim() || null,
      reason: 'Manually edited by owner',
    }

    await handleFeedback(item, true, override)
  }

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
              Private owner workspace connected to your separate Gmail Assistant backend.
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          {authLoading ? (
            <p className="text-white/70 text-sm">Checking Gmail backend connection…</p>
          ) : !assistantAuthenticated ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-4">
              <h2 className="text-white font-semibold mb-2">Connect Gmail Backend</h2>
              <p className="text-white/65 text-sm mb-3">
                Your owner login worked. Next, authenticate the Python Gmail assistant backend.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleConnectGmail}
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold px-4 py-2.5 rounded-lg transition-all"
                >
                  Connect Gmail
                </button>
                <button
                  onClick={() => {
                    setError('')
                    setAuthLoading(true)
                    setBootAttempt((value) => value + 1)
                  }}
                  className="border border-white/25 bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2.5 rounded-lg transition-all"
                >
                  Retry Connection
                </button>
                <button
                  onClick={handleOpenLearningLog}
                  className="border border-cyan-300/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-100 font-semibold px-4 py-2.5 rounded-lg transition-all"
                >
                  Learning Log
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-white/15 bg-white/5 p-4 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-white/80 text-sm">
                    {counts.pending} pending · {counts.accepted} accepted · {counts.skipped} skipped
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleOpenLearningLog}
                      className="border border-cyan-300/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-100 font-semibold px-4 py-2 rounded-lg transition-all"
                    >
                      Learning Log
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={processing}
                      className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-all"
                    >
                      {processing ? 'Analyzing…' : 'Analyze Emails'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(['all', 'pending', 'accepted', 'skipped'] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                        filter === value
                          ? 'border-emerald-300/70 bg-emerald-400/20 text-emerald-100'
                          : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {filteredSuggestions.length === 0 ? (
                  <div className="rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/65">
                    {counts.total === 0 ? 'No suggestions yet. Click Analyze Emails to begin.' : `No ${filter} items.`}
                  </div>
                ) : (
                  filteredSuggestions.map((item) => {
                    const isBusy = busyById[item.email_id]
                    return (
                      <article key={item.email_id} className="rounded-xl border border-white/15 bg-white/5 p-4">
                        <p className="text-white text-sm font-semibold">{formatFrom(item.email.from)}</p>
                        <p className="text-white/85 text-sm mt-0.5">{item.email.subject || '(no subject)'}</p>
                        <p className="text-white/45 text-xs mt-0.5">{formatDate(item.email.date)}</p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-cyan-400/15 border border-cyan-300/35 text-cyan-100 px-2.5 py-1 text-xs font-semibold">
                            {item.suggestion.action.replace('_', ' ')}
                          </span>
                          {item.suggestion.add_label_ids.map((labelId) => {
                            const label = labels.find((candidate) => candidate.id === labelId)
                            return (
                              <span
                                key={`${item.email_id}-${labelId}`}
                                className="rounded-full border border-white/20 bg-white/5 text-white/70 px-2.5 py-1 text-xs"
                              >
                                {label?.name ?? labelId}
                              </span>
                            )
                          })}
                        </div>

                        <p className="text-white/70 text-sm mt-3">{item.suggestion.reason}</p>
                        <p className="text-white/55 text-sm mt-2">{item.email.snippet}</p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {item.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleFeedback(item, true)}
                                disabled={isBusy}
                                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white px-3 py-1.5 text-sm font-semibold transition-colors"
                              >
                                {isBusy ? 'Saving…' : 'Accept'}
                              </button>
                              <button
                                onClick={() => toggleEdit(item)}
                                disabled={isBusy}
                                className="rounded-lg border border-cyan-200/35 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-60 text-cyan-100 px-3 py-1.5 text-sm font-semibold transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleFeedback(item, false)}
                                disabled={isBusy}
                                className="rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 disabled:opacity-60 text-white px-3 py-1.5 text-sm font-semibold transition-colors"
                              >
                                Skip
                              </button>
                            </>
                          ) : (
                            <span className="rounded-full border border-white/20 bg-white/10 text-white/75 px-3 py-1 text-xs uppercase tracking-wide">
                              {item.status}
                            </span>
                          )}
                        </div>

                        {item.status === 'pending' && editOpenById[item.email_id] && overridesById[item.email_id] && (
                          <div className="mt-4 rounded-lg border border-white/20 bg-black/10 p-3">
                            <p className="text-white text-sm font-semibold mb-3">Edit suggestion</p>

                            <div className="mb-3">
                              <label className="text-white/75 text-xs mb-1.5 block">Action</label>
                              <select
                                value={overridesById[item.email_id].action}
                                onChange={(event) => setDraftAction(item.email_id, event.target.value as SuggestionAction)}
                                className="w-full rounded-md border border-white/20 bg-white/10 px-2.5 py-2 text-sm text-white"
                              >
                                <option value="keep">keep</option>
                                <option value="archive">archive</option>
                                <option value="delete">delete</option>
                                <option value="mark_unread">mark unread</option>
                              </select>
                            </div>

                            <div className="mb-3">
                              <p className="text-white/75 text-xs mb-1.5">Labels</p>
                              <div className="flex flex-wrap gap-2">
                                {editableLabels.map((label) => {
                                  const selected = overridesById[item.email_id].add_label_ids.includes(label.id)
                                  return (
                                    <button
                                      key={`${item.email_id}-${label.id}`}
                                      type="button"
                                      onClick={() => toggleDraftLabel(item.email_id, label.id)}
                                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                        selected
                                          ? 'border-emerald-300/60 bg-emerald-400/20 text-emerald-100'
                                          : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
                                      }`}
                                    >
                                      {label.name}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="mb-3">
                              <label className="text-white/75 text-xs mb-1.5 block">New label name (optional)</label>
                              <input
                                value={overridesById[item.email_id].new_label_name}
                                onChange={(event) => setDraftNewLabel(item.email_id, event.target.value)}
                                placeholder="New label name"
                                className="w-full rounded-md border border-white/20 bg-white/10 px-2.5 py-2 text-sm text-white placeholder:text-white/40"
                              />
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleApplyOverride(item)}
                                disabled={isBusy}
                                className="rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white px-3 py-1.5 text-sm font-semibold transition-colors"
                              >
                                {isBusy ? 'Applying…' : 'Apply Changes'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditOpenById((prev) => ({ ...prev, [item.email_id]: false }))}
                                className="rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 text-sm font-semibold transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  })
                )}
              </div>
            </>
          )}

          <p className="text-white/45 text-xs mt-6">
            This area is password protected and intended for owner-only access.
          </p>
        </div>
      </div>
    </div>
  )
}

interface SuggestionItem {
  email_id: string
  email: {
    from: string
    subject: string
    date: string
    snippet: string
  }
  suggestion: {
    action: string
    add_label_ids: Array<string>
    new_label_name: string | null
    reason: string
  }
  status: 'pending' | 'accepted' | 'skipped' | string
}

type SuggestionAction = 'keep' | 'archive' | 'delete' | 'mark_unread'

interface SuggestionOverrideDraft {
  action: SuggestionAction
  add_label_ids: Array<string>
  new_label_name: string
}

interface SuggestionOverridePayload {
  action: SuggestionAction
  add_label_ids: Array<string>
  new_label_name: string | null
  reason: string
}

function formatFrom(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</)
  if (match?.[1]) return match[1].trim()
  return from.replace(/<.*>/, '').trim() || from
}

function formatDate(date: string): string {
  if (!date) return ''
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  const now = new Date()
  if (parsed.toDateString() === now.toDateString()) {
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
