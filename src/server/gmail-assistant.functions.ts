import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_ASSISTANT_API_BASE_URL = 'https://chimerical-creponne-ae8827.onrender.com/'

function getAssistantBaseUrl(): string {
  const baseUrl = process.env.GMAIL_ASSISTANT_API_BASE_URL?.trim()
  if (!baseUrl) {
    return DEFAULT_ASSISTANT_API_BASE_URL
  }
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

async function callAssistant(path: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const url = new URL(path.replace(/^\//, ''), getAssistantBaseUrl())
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    })

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = typeof body?.detail === 'string' ? body.detail : `HTTP ${response.status}`
      throw new Error(detail)
    }

    return body
  } finally {
    clearTimeout(timeout)
  }
}

export const getGmailAuthStatus = createServerFn({ method: 'GET' }).handler(async () => {
  return callAssistant('/api/auth/status') as Promise<{ authenticated: boolean }>
})

export const connectGmailAuth = createServerFn({ method: 'POST' }).handler(async () => {
  return callAssistant('/api/auth/connect', { method: 'POST' }) as Promise<{
    status: string
    auth_url?: string
  }>
})

export const getGmailLabels = createServerFn({ method: 'GET' }).handler(async () => {
  return callAssistant('/api/labels') as Promise<{ labels: Array<{ id: string; name: string }> }>
})

export const getGmailSuggestions = createServerFn({ method: 'GET' }).handler(async () => {
  return callAssistant('/api/suggestions') as Promise<{ suggestions: Array<any> }>
})

export const processGmailEmails = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ days: z.number().int().min(1).max(7), maxResults: z.number().int().min(1).max(5) }))
  .handler(async ({ data }) => {
    const query = new URLSearchParams({
      days: String(data.days),
      max_results: String(data.maxResults),
    })
    return callAssistant(`/api/process?${query.toString()}`, { method: 'POST' }) as Promise<{
      suggestions: Array<any>
      total: number
    }>
  })

export const submitGmailFeedback = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      email_id: z.string().min(1),
      accepted: z.boolean(),
      suggestion: z.record(z.any()),
      email: z.record(z.any()),
      override: z.record(z.any()).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    return callAssistant('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<{ status: string }>
  })

export const getLearningLogUrl = createServerFn({ method: 'GET' }).handler(async () => {
  const url = new URL('learning', getAssistantBaseUrl())
  return { url: url.toString() }
})
