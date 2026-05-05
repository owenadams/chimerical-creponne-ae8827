import { createServerFn } from '@tanstack/react-start'
import { getStore } from '@netlify/blobs'
import { z } from 'zod'

export interface Player {
  id: string
  name: string
  isHost: boolean
  isEliminated: boolean
}

export interface GameState {
  roomId: string
  category: string
  status: 'waiting' | 'playing' | 'finished'
  players: Player[]
  usedLetters: string[]
  currentPlayerIndex: number
  turnStartedAt: number | null
  turnTimeLimit: number
  loserId: string | null
  winnerId: string | null
}

function getGameStore() {
  return getStore({ name: 'alphabet-game', consistency: 'strong' })
}

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 14)
}

async function getGame(roomId: string): Promise<GameState | null> {
  const store = getGameStore()
  return store.get(roomId, { type: 'json' }) as Promise<GameState | null>
}

async function saveGame(state: GameState): Promise<void> {
  const store = getGameStore()
  await store.setJSON(state.roomId, state)
}

export const createRoom = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      hostName: z.string().min(1).max(30),
      category: z.string().min(1).max(100),
    })
  )
  .handler(async ({ data }) => {
    const roomId = generateRoomId()
    const hostId = generatePlayerId()
    const state: GameState = {
      roomId,
      category: data.category,
      status: 'waiting',
      players: [{ id: hostId, name: data.hostName, isHost: true, isEliminated: false }],
      usedLetters: [],
      currentPlayerIndex: 0,
      turnStartedAt: null,
      turnTimeLimit: 20,
      loserId: null,
      winnerId: null,
    }
    await saveGame(state)
    return { roomId, playerId: hostId }
  })

export const joinRoom = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      roomId: z.string(),
      playerName: z.string().min(1).max(30),
    })
  )
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'waiting') throw new Error('Game already started')
    if (state.players.length >= 8) throw new Error('Room is full')

    const playerId = generatePlayerId()
    state.players.push({ id: playerId, name: data.playerName, isHost: false, isEliminated: false })
    await saveGame(state)
    return { playerId }
  })

export const startGame = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      roomId: z.string(),
      playerId: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')

    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can start the game')
    if (state.players.length < 2) throw new Error('Need at least 2 players')
    if (state.status !== 'waiting') throw new Error('Game already started')

    state.status = 'playing'
    state.currentPlayerIndex = 0
    state.turnStartedAt = Date.now()
    await saveGame(state)
    return { success: true }
  })

export const claimLetter = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      roomId: z.string(),
      playerId: z.string(),
      letter: z.string().length(1),
    })
  )
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'playing') throw new Error('Game not in progress')

    const activePlayers = state.players.filter((p) => !p.isEliminated)
    const currentPlayer = activePlayers[state.currentPlayerIndex % activePlayers.length]
    if (!currentPlayer || currentPlayer.id !== data.playerId) {
      throw new Error('Not your turn')
    }

    const letter = data.letter.toUpperCase()
    if (state.usedLetters.includes(letter)) throw new Error('Letter already used')

    state.usedLetters.push(letter)

    // Advance to next active player
    const nextIndex = (state.currentPlayerIndex + 1) % activePlayers.length
    state.currentPlayerIndex = nextIndex
    state.turnStartedAt = Date.now()
    await saveGame(state)
    return { success: true }
  })

export const eliminatePlayer = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      roomId: z.string(),
      playerId: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    if (state.status !== 'playing') throw new Error('Game not in progress')

    const activePlayers = state.players.filter((p) => !p.isEliminated)
    const currentPlayer = activePlayers[state.currentPlayerIndex % activePlayers.length]
    if (!currentPlayer || currentPlayer.id !== data.playerId) {
      throw new Error('Not your turn')
    }

    // Eliminate the timed-out player
    const playerInList = state.players.find((p) => p.id === data.playerId)
    if (playerInList) playerInList.isEliminated = true

    const remainingActive = state.players.filter((p) => !p.isEliminated)
    if (remainingActive.length <= 1) {
      // Game over
      state.status = 'finished'
      state.loserId = data.playerId
      state.winnerId = remainingActive[0]?.id ?? null
      state.turnStartedAt = null
    } else {
      // Keep current index (it now points to the next player since we removed one)
      state.currentPlayerIndex = state.currentPlayerIndex % remainingActive.length
      state.turnStartedAt = Date.now()
    }

    await saveGame(state)
    return { success: true }
  })

export const getGameState = createServerFn({ method: 'GET' })
  .inputValidator((data: { roomId: string }) => data)
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    return state
  })

export const updateCategory = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      roomId: z.string(),
      playerId: z.string(),
      category: z.string().min(1).max(100),
    })
  )
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can change the category')
    if (state.status !== 'waiting') throw new Error('Cannot change category after game starts')
    state.category = data.category
    await saveGame(state)
    return { success: true }
  })

export const resetGame = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      roomId: z.string(),
      playerId: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const state = await getGame(data.roomId)
    if (!state) throw new Error('Room not found')
    const player = state.players.find((p) => p.id === data.playerId)
    if (!player?.isHost) throw new Error('Only the host can reset the game')

    state.status = 'waiting'
    state.usedLetters = []
    state.currentPlayerIndex = 0
    state.turnStartedAt = null
    state.loserId = null
    state.winnerId = null
    state.players.forEach((p) => (p.isEliminated = false))
    await saveGame(state)
    return { success: true }
  })
