import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import { useSettingsStore } from '@/lib/books/store/settingsStore'
import type { LLMSettings } from '@/lib/books/store/settingsStore'

export const Route = createFileRoute('/books/settings')({
  component: SettingsPage,
})

const PRESETS: { label: string; description: string; settings: LLMSettings }[] = [
  {
    label: 'Local Ollama',
    description: 'Free, runs on your machine, no API key required.',
    settings: { baseUrl: 'http://localhost:11434/v1', apiKey: 'ollama', model: 'llama3.2' },
  },
  {
    label: 'Groq (Free Tier)',
    description: '~9k free requests/month. Get a free API key at console.groq.com.',
    settings: { baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', model: 'mixtral-8x7b-32768' },
  },
  {
    label: 'OpenAI',
    description: 'Paste your own OpenAI API key below after selecting.',
    settings: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' },
  },
  {
    label: 'Gemini (OpenAI-compatible)',
    description: "Uses Google's OpenAI-compatible endpoint with your Gemini API key.",
    settings: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: '',
      model: 'gemini-2.0-flash',
    },
  },
]

function SettingsPage() {
  const llm = useSettingsStore((state) => state.llm)
  const setLLMSettings = useSettingsStore((state) => state.setLLMSettings)

  const [form, setForm] = useState<LLMSettings>(llm)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  function update<K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  function handleSave(e: FormEvent) {
    e.preventDefault()
    setLLMSettings(form)
    setSaved(true)
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-100">Settings</h1>
      <p className="mb-4 text-sm text-slate-400">
        Connect an AI provider for personalized recommendations. Everything here — including your
        API key — is stored only in this browser's local storage and never sent anywhere except
        directly to the provider you choose.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setForm(preset.settings)}
            className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-left transition-colors hover:border-slate-600"
          >
            <p className="text-sm font-medium text-slate-100">{preset.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{preset.description}</p>
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="base-url">
            Base URL
          </label>
          <input
            id="base-url"
            type="text"
            value={form.baseUrl}
            onChange={(e) => update('baseUrl', e.target.value)}
            placeholder="http://localhost:11434/v1"
            className="w-full rounded-md border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="api-key">
            API key
          </label>
          <div className="relative">
            <input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              className="w-full rounded-md border border-slate-800 bg-slate-950 p-2 pr-9 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400" htmlFor="model">
            Model
          </label>
          <input
            id="model"
            type="text"
            value={form.model}
            onChange={(e) => update('model', e.target.value)}
            placeholder="llama3.2"
            className="w-full rounded-md border border-slate-800 bg-slate-950 p-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-slate-600 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            'Save settings'
          )}
        </button>
      </form>
    </div>
  )
}
