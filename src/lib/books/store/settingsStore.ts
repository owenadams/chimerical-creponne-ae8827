import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** LLM connection is modeled as a generic OpenAI-compatible endpoint so the
 *  same settings UI works for local Ollama, OpenAI, or any compatible proxy
 *  (e.g. Gemini via an OpenAI-compatible gateway). */
export interface LLMSettings {
  baseUrl: string
  apiKey: string
  model: string
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  model: 'llama3.2',
}

interface SettingsState {
  llm: LLMSettings
  setLLMSettings: (settings: LLMSettings) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      llm: DEFAULT_LLM_SETTINGS,
      setLLMSettings: (llm) => set({ llm }),
    }),
    // This app is server-rendered (TanStack Start); localStorage doesn't exist during SSR,
    // so hydration is skipped here and triggered manually client-side (see routes/books.tsx).
    { name: 'book-tracker-settings', skipHydration: true },
  ),
)
