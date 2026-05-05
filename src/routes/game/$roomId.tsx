import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { GameState } from '@/server/game.functions'
import {
  getGameState,
  startGame,
  claimLetter,
  eliminatePlayer,
  resetGame,
  updateCategory,
} from '@/server/game.functions'

export const Route = createFileRoute('/game/$roomId')({
  component: GameRoom,
})

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function useCountdown(turnStartedAt: number | null, timeLimit: number) {
  const [remaining, setRemaining] = useState(timeLimit)

  useEffect(() => {
    if (turnStartedAt === null) {
      setRemaining(timeLimit)
      return
    }
    const tick = () => {
      const elapsed = (Date.now() - turnStartedAt) / 1000
      setRemaining(Math.max(0, timeLimit - elapsed))
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [turnStartedAt, timeLimit])

  return remaining
}

function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const pct = remaining / total
  const r = 42
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const color = remaining > 10 ? '#a855f7' : remaining > 5 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.1s linear, stroke 0.5s' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-black text-white tabular-nums">{Math.ceil(remaining)}</span>
      </div>
    </div>
  )
}

function GameRoom() {
  const { roomId } = Route.useParams()
  const navigate = useNavigate()

  const [game, setGame] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState(false)
  const [eliminationSent, setEliminationSent] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load player id from session storage
  useEffect(() => {
    const id = sessionStorage.getItem(`player-${roomId}`)
    if (!id) {
      navigate({ to: '/alphabet' })
      return
    }
    setPlayerId(id)
  }, [roomId, navigate])

  const fetchState = useCallback(async () => {
    try {
      const state = await getGameState({ data: { roomId } })
      if (!state) {
        navigate({ to: '/alphabet' })
        return
      }
      setGame(state)
    } catch {
      // silently ignore poll errors
    }
  }, [roomId, navigate])

  useEffect(() => {
    fetchState()
    pollRef.current = setInterval(fetchState, 1500)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchState])

  const activePlayers = game?.players.filter((p) => !p.isEliminated) ?? []
  const currentPlayer = activePlayers[game ? game.currentPlayerIndex % Math.max(activePlayers.length, 1) : 0]
  const isMyTurn = currentPlayer?.id === playerId
  const me = game?.players.find((p) => p.id === playerId)
  const isHost = me?.isHost ?? false
  const remaining = useCountdown(game?.status === 'playing' ? (game.turnStartedAt ?? null) : null, game?.turnTimeLimit ?? 20)

  // Auto-eliminate when timer hits 0 (only the current player reports their own timeout)
  useEffect(() => {
    if (!game || game.status !== 'playing') {
      setEliminationSent(false)
      return
    }
    if (isMyTurn && remaining === 0 && !eliminationSent) {
      setEliminationSent(true)
      eliminatePlayer({ data: { roomId, playerId: playerId! } }).catch(() => {})
    }
  }, [remaining, isMyTurn, game, roomId, playerId, eliminationSent])

  // Reset elimination flag on new turn
  useEffect(() => {
    if (game?.turnStartedAt) {
      setEliminationSent(false)
    }
  }, [game?.turnStartedAt])

  async function handleClaim(letter: string) {
    if (!isMyTurn || busy || !playerId) return
    setBusy(true)
    setError('')
    try {
      await claimLetter({ data: { roomId, playerId, letter } })
      await fetchState()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function handleStart() {
    if (!playerId || busy) return
    setBusy(true)
    setError('')
    try {
      await startGame({ data: { roomId, playerId } })
      await fetchState()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    if (!playerId || busy) return
    setBusy(true)
    setError('')
    try {
      await resetGame({ data: { roomId, playerId } })
      await fetchState()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateCategory() {
    if (!playerId || !newCategory.trim() || busy) return
    setBusy(true)
    try {
      await updateCategory({ data: { roomId, playerId, category: newCategory.trim() } })
      setEditingCategory(false)
      setNewCategory('')
      await fetchState()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Loading…</div>
      </div>
    )
  }

  const loser = game.loserId ? game.players.find((p) => p.id === game.loserId) : null
  const winner = game.winnerId ? game.players.find((p) => p.id === game.winnerId) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 p-3 sm:p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-black text-xl">🔤 Alphabet Game</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/50 text-xs font-mono">Room: {roomId}</span>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(roomId)
                }}
                className="text-purple-400 text-xs hover:text-purple-300"
                title="Copy room code"
              >
                Copy
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: '/alphabet' })}
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            Leave
          </button>
        </div>

        {/* Category */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Category</div>
              <div className="text-white font-bold text-lg">{game.category}</div>
            </div>
            {isHost && game.status === 'waiting' && !editingCategory && (
              <button
                onClick={() => { setNewCategory(game.category); setEditingCategory(true) }}
                className="text-purple-400 text-sm hover:text-purple-300"
              >
                Edit
              </button>
            )}
          </div>
          {editingCategory && (
            <div className="mt-3 flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
                placeholder="New category"
                maxLength={100}
              />
              <button onClick={handleUpdateCategory} className="bg-purple-500 hover:bg-purple-400 text-white px-3 py-2 rounded-lg text-sm font-semibold">Save</button>
              <button onClick={() => setEditingCategory(false)} className="text-white/50 hover:text-white/80 px-2 py-2 rounded-lg text-sm">✕</button>
            </div>
          )}
        </div>

        {/* Players */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
          <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Players</div>
          <div className="flex flex-wrap gap-2">
            {game.players.map((p) => {
              const isActive = !p.isEliminated
              const isCurrent = game.status === 'playing' && currentPlayer?.id === p.id
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    p.isEliminated
                      ? 'bg-red-900/30 text-red-400 line-through opacity-60'
                      : isCurrent
                      ? 'bg-purple-500 text-white ring-2 ring-purple-300 ring-offset-1 ring-offset-transparent'
                      : 'bg-white/10 text-white/80'
                  }`}
                >
                  {p.name}
                  {p.isHost && <span className="text-yellow-400 text-xs">👑</span>}
                  {p.id === playerId && <span className="text-white/50 text-xs">(you)</span>}
                  {!isActive && <span className="text-xs">💀</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Waiting state */}
        {game.status === 'waiting' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-white/70 mb-4">Waiting for players to join…</p>
            <div className="bg-white/10 rounded-xl p-4 mb-4">
              <p className="text-white/50 text-xs mb-1">Share this room code</p>
              <p className="text-4xl font-black text-white font-mono tracking-widest">{roomId}</p>
            </div>
            {isHost && (
              <button
                onClick={handleStart}
                disabled={game.players.length < 2 || busy}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all text-lg"
              >
                {game.players.length < 2 ? 'Need at least 2 players' : 'Start Game'}
              </button>
            )}
            {!isHost && <p className="text-white/40 text-sm">Waiting for host to start…</p>}
          </div>
        )}

        {/* Playing state */}
        {game.status === 'playing' && (
          <>
            {/* Current turn */}
            <div className={`rounded-2xl p-5 border text-center transition-all ${
              isMyTurn
                ? 'bg-purple-500/20 border-purple-400/50 ring-1 ring-purple-400/30'
                : 'bg-white/5 border-white/10'
            }`}>
              {isMyTurn ? (
                <>
                  <p className="text-purple-300 font-semibold text-sm mb-2">🎯 Your turn!</p>
                  <TimerRing remaining={remaining} total={game.turnTimeLimit} />
                  <p className="text-white/60 text-xs mt-2">
                    Say something in <span className="text-white font-medium">"{game.category}"</span> then tap the first letter
                  </p>
                </>
              ) : (
                <>
                  <p className="text-white/50 text-sm mb-2">
                    <span className="text-white font-semibold">{currentPlayer?.name}</span>'s turn
                  </p>
                  <TimerRing remaining={remaining} total={game.turnTimeLimit} />
                  <p className="text-white/40 text-xs mt-2">Waiting for them to pick a letter…</p>
                </>
              )}
            </div>

            {/* Letter grid */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Letters</div>
              <div className="grid grid-cols-7 gap-1.5">
                {ALPHABET.map((letter) => {
                  const used = game.usedLetters.includes(letter)
                  const available = !used && isMyTurn
                  return (
                    <button
                      key={letter}
                      onClick={() => handleClaim(letter)}
                      disabled={used || !available || busy}
                      className={`aspect-square rounded-lg text-sm font-black flex items-center justify-center transition-all active:scale-95 ${
                        used
                          ? 'bg-white/5 text-white/20 cursor-default line-through'
                          : available
                          ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-lg shadow-purple-900/50 cursor-pointer'
                          : 'bg-white/10 text-white/50 cursor-default'
                      }`}
                    >
                      {letter}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 text-center text-white/40 text-xs">
                {26 - game.usedLetters.length} letters remaining
              </div>
            </div>
          </>
        )}

        {/* Finished state */}
        {game.status === 'finished' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
            <div className="text-5xl mb-3">{loser?.id === playerId ? '💀' : '🏆'}</div>
            <h2 className="text-white font-black text-2xl mb-1">Game Over!</h2>
            {loser && (
              <p className="text-red-400 font-semibold mb-1">
                {loser.id === playerId ? 'You ran' : `${loser.name} ran`} out of time!
              </p>
            )}
            {winner && (
              <p className="text-green-400 font-semibold mb-4">
                🎉 {winner.id === playerId ? 'You win' : `${winner.name} wins`}!
              </p>
            )}
            <div className="bg-white/10 rounded-xl p-3 mb-4 text-left">
              <p className="text-white/50 text-xs mb-2">Letters used ({game.usedLetters.length}/26):</p>
              <div className="flex flex-wrap gap-1">
                {game.usedLetters.map((l) => (
                  <span key={l} className="bg-purple-500/30 text-purple-300 rounded-md px-2 py-0.5 text-sm font-mono font-bold">{l}</span>
                ))}
              </div>
            </div>
            {isHost && (
              <button
                onClick={handleReset}
                disabled={busy}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all text-lg"
              >
                Play Again
              </button>
            )}
            {!isHost && <p className="text-white/40 text-sm mt-2">Waiting for host to start a new game…</p>}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
