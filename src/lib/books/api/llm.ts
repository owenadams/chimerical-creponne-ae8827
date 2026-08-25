import { z } from 'zod'
import type { LLMSettings } from '../store/settingsStore'
import type { RawRecommendation, TrackedBook } from '../types/book'

const RecommendationSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  reason: z.string().min(1),
})

const RecommendationsResponseSchema = z.object({
  recommendations: z.array(RecommendationSchema).min(1).max(5),
})

const SYSTEM_PROMPT = `You are a personalized book recommendation engine. The user will describe the books \
they rated highest (with notes/tropes), plus books already on their want-to-read list that they haven't \
read yet but are excited about — treat those want-to-read titles as a strong signal you're on the right \
track, since the user chose to add them. Recommend 3 to 5 NEW books, never repeating anything already \
listed, that they are likely to love based on genre, tone, and tropes in common.

Respond ONLY with a valid JSON object, no markdown code fences, no commentary. Format exactly:
{"recommendations":[{"title":"...","author":"...","reason":"one or two sentence personalized reason"}]}`

function describeBook(book: TrackedBook): string {
  const parts = [`"${book.title}" by ${book.authors.join(', ') || 'Unknown'} (tier ${book.tier.toUpperCase()})`]
  if (book.genres.length) parts.push(`genres: ${book.genres.join(', ')}`)
  if (book.tropes.length) parts.push(`favorite tropes: ${book.tropes.join(', ')}`)
  if (book.notes) parts.push(`notes: ${book.notes}`)
  return parts.join(' — ')
}

function describeWantToRead(book: TrackedBook): string {
  const parts = [`"${book.title}" by ${book.authors.join(', ') || 'Unknown'}`]
  if (book.tropes.length) parts.push(`favorite tropes: ${book.tropes.join(', ')}`)
  return parts.join(' — ')
}

function buildUserPrompt(books: TrackedBook[]): string {
  const favorites = books.filter((b) => b.status === 'read' && (b.tier === 'S' || b.tier === 'A'))
  const wantToRead = books.filter((b) => b.status === 'want_to_read')

  const favoritesList = favorites.map((b) => `- ${describeBook(b)}`).join('\n')
  const wantToReadSection = wantToRead.length
    ? `\n\nI also already want to read these (I agree with recommending books like these, so don't suggest them again):\n${wantToRead.map((b) => `- ${describeWantToRead(b)}`).join('\n')}`
    : ''

  return `Here are my favorite (S and A tier) books:\n${favoritesList}${wantToReadSection}\n\nRecommend 3-5 new books for me that I don't already have listed above.`
}

/** Strip markdown code fences some models wrap JSON responses in, and fall back to
 *  slicing from the first `{` to the last `}` for models that add extra prose
 *  around the JSON despite instructions not to. */
function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced) return fenced[1]

  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return content.slice(start, end + 1)
  }
  return content.trim()
}

/** Request personalized recommendations from a generic OpenAI-compatible chat endpoint
 *  (works with local Ollama, OpenAI, or any compatible gateway/proxy). Considers both
 *  S/A tier favorites and the want-to-read queue (treated as an agreement signal). */
export async function requestRecommendations(
  settings: LLMSettings,
  books: TrackedBook[],
): Promise<RawRecommendation[]> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(books) },
  ]
  const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`

  async function callChat(useJsonMode: boolean) {
    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.8,
        ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages,
      }),
    })
  }

  // Not every OpenAI-compatible provider supports response_format; retry without it if rejected.
  let res: Response
  try {
    res = await callChat(true)
    if (!res.ok && res.status === 400) {
      res = await callChat(false)
    }
  } catch {
    // A network-level failure (not an HTTP error status) almost always means the browser
    // couldn't even reach the endpoint — most commonly a local Ollama server that isn't
    // running, isn't reachable from this device, or hasn't allow-listed this site's origin via CORS.
    const isLocalhost = /localhost|127\.0\.0\.1/.test(settings.baseUrl)
    throw new Error(
      isLocalhost
        ? `Could not reach ${settings.baseUrl}. "localhost" only works on the same device that is \
running Ollama — if you're on a different device (e.g. your phone), switch to a cloud provider \
like OpenAI or Gemini in Settings instead. If you are on the right device, make sure Ollama is \
running and that it allows requests from this site — for Ollama, set the OLLAMA_ORIGINS \
environment variable to include this site's URL, then restart it.`
        : `Could not reach ${settings.baseUrl}. Check the base URL in Settings and your network connection.`,
    )
  }
  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const content: string | undefined = data.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM response had no content')

  const jsonText = extractJson(content)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('LLM response was not valid JSON')
  }

  const result = RecommendationsResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('LLM response did not match the expected recommendation format')
  }

  return result.data.recommendations
}
