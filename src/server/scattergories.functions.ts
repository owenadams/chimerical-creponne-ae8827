import { createServerFn } from '@tanstack/react-start'
import { getStore } from '@netlify/blobs'
import { z } from 'zod'

const CATEGORY_POOL = [
  'Animals',
  "Boy's Names",
  "Girl's Names",
  'Countries',
  'Things in a Supermarket',
  'TV Shows',
  'Foods',
  'Colours',
  'Things at the Seaside',
  'Sports',
  'Films',
  'Musical Instruments',
  'Things in a Kitchen',
  'Jobs / Professions',
  'Types of Transport',
  'Things at School',
  'Cities in the UK',
  'Board Games',
  'Cartoon Characters',
  'Things You Find in a Park',
  'Sweet Treats',
  'Items of Clothing',
  'Vegetables',
  'Drinks',
  'Famous Landmarks',
  'Things in a Garden',
  'Things in a Bedroom',
  'Famous People',
  'Song Titles',
  'Things You Take on Holiday',
  'Animals That Can Swim',
  'Types of Music',
  'Things at Christmas',
  'Brand Names',
  'Fruit',
  'Things in a Hospital',
  'Things That Make a Loud Noise',
  'Things Found in a School Bag',
  'Words That Describe a Kind Person',
  'Things With Four Legs',
]

export interface ScattergoriesPlayer {
  id: string
  name: string
  isHost: boolean
  answers: Record<string, string>
}

export interface ScattergoriesGameState {
  roomId: string
  status: 'waiting' | 'playing' | 'reviewing' | 'finished'
  letter: string | null
  categories: string[]
  players: ScattergoriesPlayer[]
  timerStartedAt: number | null
  isTimerRunning: boolean
  elapsedMs: number
  timeLimit: number
  redactedAnswers: Array<{ playerId: string; category: string }>
  finalScores: Record<string, number>
  winnerId: string | null
}

function getScattergoriesStore() {
  return getStore({ name: 'scattergories-game', consistency: 'strong' })
}

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 14)
}

function rollRandomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26))
}

function pickCategories(): string[] {
  const pool = [...CATEGORY_POOL]
  const result: string[] = []
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    result.push(pool[idx])
    pool.splice(idx, 1)
  }
  return result
}

async function getGame(roomId: string): Promise<ScattergoriesGameState | null> {
  const store = getScattergoriesStore()
  return store.get(roomId, { type: 'json' }) as Promise<ScattergoriesGameState | null>
}

async function saveGame(state: ScattergoriesGameState): Promise<void> {
  const store = getScattergoriesStore()
  await store.setJSON(state.roomId, state)
}

export const createScattergoriesRoom = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ hostName: z.string().min(1).max(30) }))
  .handler(async ({ data }) => {
    const roomId = generateRoomId()
    const hostId = generatePlayerId()
    const state: ScattergoriesGameState = {
      roomId,
      status: 'waiting',
      letter: null,
      categories: pickCategories(),
      players: [{ id: hostId, name: data.hostName, isHost: true, answers: {} }],
      timerStartedAt: null,
      isTimerRunning: false,
      elapsedMs: 0,
      timeLimit: 60,
      redactedAnswers: [],
      finalScores: {},
      winnerId: null,
    }
    await saveGame(state)
    return { roomId, playerId: hostId }
  })

export const joinScattergoriesRoom = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ roomId: z.string(), playerName: z.string().min(1).max(30) }))
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'waiting') throw new Error('Game already started')
    if (state.players.length >= 8) throw new Error('Room is full')
    const playerId = generatePlayerId()
    state.players.push({ id: playerId, name: data.playerName, isHost: false, answers: {} })
    await saveGame(state)
    return { playerId }
  })

export const rollScattergoriesLetter = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ roomId: z.string(), playerId: z.string() }))
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'waiting') throw new Error('Can only roll letter in waiting phase')
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can roll the letter')
    state.letter = rollRandomLetter()
    await saveGame(state)
    return { letter: state.letter }
  })

export const startScattergoriesRound = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ roomId: z.string(), playerId: z.string() }))
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (!state.letter) throw new Error('Roll the letter first')
    if (state.status !== 'waiting') throw new Error('Game already started')
    if (state.players.length < 2) throw new Error('Need at least 2 players to start')
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can start the round')
    state.status = 'playing'
    state.timerStartedAt = Date.now()
    state.isTimerRunning = true
    state.elapsedMs = 0
    state.players.forEach((p) => { p.answers = {} })
    await saveGame(state)
    return { success: true }
  })

export const pauseScattergoriesTimer = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ roomId: z.string(), playerId: z.string() }))
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'playing' || !state.isTimerRunning) return { success: true }
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can pause the timer')
    state.elapsedMs += Date.now() - (state.timerStartedAt ?? Date.now())
    state.isTimerRunning = false
    state.timerStartedAt = null
    await saveGame(state)
    return { success: true }
  })

export const resumeScattergoriesTimer = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ roomId: z.string(), playerId: z.string() }))
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'playing' || state.isTimerRunning) return { success: true }
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can resume the timer')
    state.timerStartedAt = Date.now()
    state.isTimerRunning = true
    await saveGame(state)
    return { success: true }
  })

export const resetScattergoriesTimer = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ roomId: z.string(), playerId: z.string() }))
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'playing') return { success: true }
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can reset the timer')
    state.elapsedMs = 0
    state.timerStartedAt = Date.now()
    state.isTimerRunning = true
    await saveGame(state)
    return { success: true }
  })

export const saveScattergoriesAnswers = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      roomId: z.string(),
      playerId: z.string(),
      answers: z.record(z.string(), z.string()),
    }),
  )
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'playing' && state.status !== 'reviewing') return { success: true }
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player) throw new Error('Player not found')
    player.answers = data.answers
    await saveGame(state)
    return { success: true }
  })

export const endScattergoriesRound = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ roomId: z.string() }))
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'playing') return { success: true }
    state.status = 'reviewing'
    state.isTimerRunning = false
    state.timerStartedAt = null
    await saveGame(state)
    return { success: true }
  })

export const redactScattergoriesAnswer = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      roomId: z.string(),
      playerId: z.string(),
      targetPlayerId: z.string(),
      category: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'reviewing') throw new Error('Not in review phase')
    const existingIdx = state.redactedAnswers.findIndex(
      (r) => r.playerId === data.targetPlayerId && r.category === data.category,
    )
    if (existingIdx >= 0) {
      state.redactedAnswers.splice(existingIdx, 1)
    } else {
      state.redactedAnswers.push({ playerId: data.targetPlayerId, category: data.category })
    }
    await saveGame(state)
    return { success: true }
  })

export const calculateScattergoriesScores = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ roomId: z.string(), playerId: z.string() }))
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'reviewing') throw new Error('Not in review phase')
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can calculate scores')

    const letter = state.letter?.toUpperCase() ?? ''
    const scores: Record<string, number> = {}

    for (const p of state.players) {
      let score = 0
      for (const category of state.categories) {
        const answer = (p.answers[category] ?? '').trim()
        const isRedacted = state.redactedAnswers.some(
          (r) => r.playerId === p.id && r.category === category,
        )
        if (!isRedacted && answer.length > 0 && answer.toUpperCase().startsWith(letter)) {
          score++
        }
      }
      scores[p.id] = score
    }

    state.finalScores = scores
    state.status = 'finished'

    let maxScore = -1
    let winnerId: string | null = null
    for (const [pid, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score
        winnerId = pid
      }
    }
    state.winnerId = winnerId

    await saveGame(state)
    return { success: true }
  })

export const resetScattergoriesGame = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ roomId: z.string(), playerId: z.string() }))
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can reset the game')

    state.status = 'waiting'
    state.letter = null
    state.categories = pickCategories()
    state.timerStartedAt = null
    state.isTimerRunning = false
    state.elapsedMs = 0
    state.redactedAnswers = []
    state.finalScores = {}
    state.winnerId = null
    state.players.forEach((p) => { p.answers = {} })

    await saveGame(state)
    return { success: true }
  })

export const getScattergoriesGameState = createServerFn({ method: 'GET' })
  .inputValidator((data: { roomId: string }) => data)
  .handler(async ({ data }) => {
    return getGame(data.roomId)
  })
