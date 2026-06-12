import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScattergoriesGameState } from '@/server/scattergories.functions'
import {
  getScattergoriesGameState,
  rollScattergoriesLetter,
  startScattergoriesRound,
  pauseScattergoriesTimer,
  resumeScattergoriesTimer,
  resetScattergoriesTimer,
  saveScattergoriesAnswers,
  endScattergoriesRound,
  redactScattergoriesAnswer,
  calculateScattergoriesScores,
  resetScattergoriesGame,
} from '@/server/scattergories.functions'

export const Route = createFileRoute('/scattergories/$roomId')({
  component: ScattergoriesRoom,
})

function useScattergoriesTimer(game: ScattergoriesGameState | null): number {
  const [remaining, setRemaining] = useState(60)

  useEffect(() => {
    if (!game) {
      setRemaining(60)
      return
    }
    const compute = () => {
      if (game.status !== 'playing') {
        setRemaining(Math.max(0, game.timeLimit - game.elapsedMs / 1000))
        return
      }
      const elapsed =
        game.elapsedMs +
        (game.isTimerRunning && game.timerStartedAt !== null
          ? Date.now() - game.timerStartedAt
          : 0)
      setRemaining(Math.max(0, game.timeLimit - elapsed / 1000))
    }
    compute()
    const id = setInterval(compute, 100)
    return () => clearInterval(id)
  }, [
    game?.timerStartedAt,
    game?.isTimerRunning,
    game?.elapsedMs,
    game?.timeLimit,
    game?.status,
  ])

  return remaining
}

function playBuzzer() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sawtooth'
    osc.frequency.value = 120
    gain.gain.setValueAtTime(0.35, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0)
    osc.start()
    osc.stop(ctx.currentTime + 1.0)
  } catch {
    // Audio not available in this context
  }
}

function TimerBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(1, remaining / total))
  const color =
    remaining > 30
      ? 'from-emerald-500 to-green-400'
      : remaining > 15
        ? 'from-amber-500 to-yellow-400'
        : 'from-red-500 to-rose-400'
  const textColor =
    remaining > 30 ? 'text-emerald-400' : remaining > 15 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white/50 text-xs uppercase tracking-wider">Time</span>
        <span className={`text-2xl font-black tabular-nums ${textColor}`}>
          {Math.ceil(remaining)}s
        </span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-100`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

function ScattergoriesRoom() {
  const { roomId } = Route.useParams()
  const navigate = useNavigate()

  const [game, setGame] = useState<ScattergoriesGameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const localAnswersRef = useRef<Record<string, string>>({})
  localAnswersRef.current = localAnswers

  const hasEndedRoundRef = useRef(false)
  const prevStatusRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const remaining = useScattergoriesTimer(game)

  useEffect(() => {
    const id = sessionStorage.getItem(`scattergories-player-${roomId}`)
    if (!id) {
      navigate({ to: '/scattergories' })
      return
    }
    setPlayerId(id)
  }, [roomId, navigate])

  const fetchState = useCallback(async () => {
    try {
      const state = await getScattergoriesGameState({ data: { roomId } })
      if (!state) {
        navigate({ to: '/scattergories' })
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

  // Detect time's up → play buzzer, save answers, end round
  useEffect(() => {
    if (!game || game.status !== 'playing') {
      hasEndedRoundRef.current = false
      return
    }
    if (remaining <= 0 && !hasEndedRoundRef.current) {
      hasEndedRoundRef.current = true
      playBuzzer()
      if (playerId) {
        saveScattergoriesAnswers({
          data: { roomId, playerId, answers: localAnswersRef.current },
        }).catch(() => {})
      }
      endScattergoriesRound({ data: { roomId } }).catch(() => {})
    }
  }, [remaining, game?.status, playerId, roomId])

  // Save answers on status transition playing → reviewing
  useEffect(() => {
    if (!game) return
    if (prevStatusRef.current === 'playing' && game.status === 'reviewing' && playerId) {
      saveScattergoriesAnswers({
        data: { roomId, playerId, answers: localAnswersRef.current },
      }).catch(() => {})
    }
    prevStatusRef.current = game.status
  }, [game?.status, playerId, roomId])

  // Auto-save answers every 5 seconds during playing
  useEffect(() => {
    if (game?.status !== 'playing' || !playerId) return
    const id = setInterval(() => {
      saveScattergoriesAnswers({
        data: { roomId, playerId, answers: localAnswersRef.current },
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [game?.status, playerId, roomId])

  const me = game?.players.find((p) => p.id === playerId)
  const isHost = me?.isHost ?? false
  const isTimedOut = game?.status === 'playing' && remaining <= 0
  const inputsLocked = game?.status !== 'playing' || isTimedOut

  async function run(fn: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await fn()
      await fetchState()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function handleRollLetter() {
    if (!playerId) return
    run(() => rollScattergoriesLetter({ data: { roomId, playerId } }))
  }

  function handleStartRound() {
    if (!playerId) return
    run(async () => {
      await startScattergoriesRound({ data: { roomId, playerId } })
      setLocalAnswers({})
      hasEndedRoundRef.current = false
    })
  }

  function handlePauseTimer() {
    if (!playerId) return
    run(() => pauseScattergoriesTimer({ data: { roomId, playerId } }))
  }

  function handleResumeTimer() {
    if (!playerId) return
    run(() => resumeScattergoriesTimer({ data: { roomId, playerId } }))
  }

  function handleResetTimer() {
    if (!playerId) return
    run(() => resetScattergoriesTimer({ data: { roomId, playerId } }))
  }

  function handleRedact(targetPlayerId: string, category: string) {
    if (!playerId) return
    run(() =>
      redactScattergoriesAnswer({ data: { roomId, playerId, targetPlayerId, category } }),
    )
  }

  function handleCalculateScores() {
    if (!playerId) return
    run(() => calculateScattergoriesScores({ data: { roomId, playerId } }))
  }

  function handlePlayAgain() {
    if (!playerId) return
    run(async () => {
      await resetScattergoriesGame({ data: { roomId, playerId } })
      setLocalAnswers({})
      hasEndedRoundRef.current = false
    })
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg animate-pulse">Loading…</div>
      </div>
    )
  }

  const sortedPlayers = [...game.players].sort(
    (a, b) => (game.finalScores[b.id] ?? 0) - (game.finalScores[a.id] ?? 0),
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 p-3 sm:p-4">
      <div className="max-w-lg mx-auto space-y-4 pb-8">

        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Link to="/" className="text-white/40 hover:text-white/70 text-xs transition-colors">
                ← Home
              </Link>
            </div>
            <h1 className="text-white font-black text-xl">📝 Scattergories</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/50 text-xs font-mono">Room: {roomId}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(roomId)}
                className="text-teal-400 text-xs hover:text-teal-300 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: '/scattergories' })}
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            Leave
          </button>
        </div>

        {/* Time's Up Banner */}
        {(isTimedOut || game.status === 'reviewing') && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-2xl p-4 text-center">
            <div className="text-3xl mb-1">🚨</div>
            <p className="text-red-300 font-black text-2xl tracking-wide">TIME'S UP!</p>
            {game.status === 'reviewing' && (
              <p className="text-white/60 text-sm mt-1">Review answers below</p>
            )}
          </div>
        )}

        {/* Players */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
          <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Players</div>
          <div className="flex flex-wrap gap-2">
            {game.players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  p.id === playerId
                    ? 'bg-teal-500/30 text-teal-200 ring-1 ring-teal-500/40'
                    : 'bg-white/10 text-white/80'
                }`}
              >
                {p.name}
                {p.isHost && <span className="text-yellow-400 text-xs">👑</span>}
                {p.id === playerId && <span className="text-white/50 text-xs">(you)</span>}
              </div>
            ))}
          </div>
        </div>

        {/* ─── WAITING STATE ─── */}
        {game.status === 'waiting' && (
          <>
            {/* Room code share */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20 text-center">
              <p className="text-white/50 text-xs mb-1">Share this room code</p>
              <p className="text-4xl font-black text-white font-mono tracking-widest">{roomId}</p>
            </div>

            {/* Categories preview */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">
                Categories for this round
              </div>
              <div className="space-y-2">
                {game.categories.map((cat, i) => (
                  <div key={cat} className="flex items-center gap-3 text-sm">
                    <span className="text-white/30 text-xs w-5 text-right">{i + 1}.</span>
                    <span className="text-white/80">{cat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Host controls */}
            {isHost && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                {game.letter ? (
                  <div className="text-center mb-5">
                    <p className="text-white/50 text-xs mb-2">Rolled letter</p>
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white text-6xl font-black shadow-lg shadow-teal-900/50">
                      {game.letter}
                    </div>
                  </div>
                ) : (
                  <div className="text-center mb-5">
                    <div className="text-4xl mb-2">🎲</div>
                    <p className="text-white/60 text-sm">Roll a letter to get started</p>
                  </div>
                )}
                <div className="space-y-2">
                  <button
                    onClick={handleRollLetter}
                    disabled={busy}
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all"
                  >
                    {game.letter ? '🔄 Reroll Letter' : '🎲 Roll Letter'}
                  </button>
                  {game.letter && (
                    <button
                      onClick={handleStartRound}
                      disabled={game.players.length < 2 || busy}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all text-lg"
                    >
                      {game.players.length < 2 ? 'Need at least 2 players' : '▶ Start Round'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Non-host waiting view */}
            {!isHost && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
                {game.letter ? (
                  <>
                    <p className="text-white/50 text-xs mb-2">Rolled letter</p>
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white text-5xl font-black shadow-lg shadow-teal-900/50 mb-3">
                      {game.letter}
                    </div>
                    <p className="text-white/50 text-sm">Waiting for host to start the round…</p>
                  </>
                ) : (
                  <>
                    <div className="text-4xl mb-2">⏳</div>
                    <p className="text-white/60">Waiting for host to roll the letter…</p>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ─── PLAYING STATE ─── */}
        {game.status === 'playing' && (
          <>
            {/* Letter + Timer */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-4xl font-black text-white shadow-lg shadow-teal-900/40">
                  {game.letter}
                </div>
                <div className="flex-1">
                  <TimerBar remaining={remaining} total={game.timeLimit} />
                </div>
              </div>

              {isHost && (
                <div className="flex gap-2">
                  {game.isTimerRunning ? (
                    <button
                      onClick={handlePauseTimer}
                      disabled={busy}
                      className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-semibold py-2 rounded-lg text-sm transition-all"
                    >
                      ⏸ Pause
                    </button>
                  ) : (
                    <button
                      onClick={handleResumeTimer}
                      disabled={busy}
                      className="flex-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-semibold py-2 rounded-lg text-sm transition-all"
                    >
                      ▶ Resume
                    </button>
                  )}
                  <button
                    onClick={handleResetTimer}
                    disabled={busy}
                    className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 font-semibold py-2 rounded-lg text-sm transition-all"
                  >
                    ↩ Reset Timer
                  </button>
                </div>
              )}

              {!isHost && !game.isTimerRunning && (
                <div className="text-center text-amber-400 text-sm font-semibold mt-2">
                  ⏸ Timer paused by host
                </div>
              )}
            </div>

            {/* Answer inputs */}
            <div className="space-y-3">
              <p className="text-white/50 text-xs uppercase tracking-wider px-1">
                Your answers — must start with{' '}
                <span className="text-teal-400 font-bold">{game.letter}</span>
              </p>
              {game.categories.map((category) => {
                const val = localAnswers[category] ?? ''
                const isEmpty = val.length === 0
                const isValid =
                  !isEmpty && val.toUpperCase().startsWith(game.letter?.toUpperCase() ?? '')
                return (
                  <div
                    key={category}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 border border-white/20"
                  >
                    <label className="block text-white/70 text-xs font-medium mb-2">
                      {category}
                    </label>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) =>
                        setLocalAnswers((prev) => ({ ...prev, [category]: e.target.value }))
                      }
                      disabled={inputsLocked}
                      placeholder={`Something starting with ${game.letter}…`}
                      maxLength={100}
                      className={`w-full bg-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none transition-all text-sm ${
                        inputsLocked
                          ? 'opacity-60 cursor-not-allowed border border-white/10'
                          : isEmpty
                            ? 'border border-white/20 focus:border-white/50'
                            : isValid
                              ? 'border border-emerald-500/50 focus:border-emerald-400'
                              : 'border border-red-500/50 focus:border-red-400'
                      }`}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ─── REVIEWING STATE ─── */}
        {game.status === 'reviewing' && (
          <div className="space-y-4">
            <p className="text-white/60 text-sm text-center">
              Click{' '}
              <span className="text-red-400 font-semibold">Redact</span> to remove answers that
              don't count. Click again to restore.
            </p>

            {/* Letter reminder */}
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-2xl font-black text-white">
                {game.letter}
              </div>
              <div>
                <p className="text-white/50 text-xs">Rolled letter</p>
                <p className="text-white font-bold text-sm">
                  All valid answers must start with <span className="text-teal-300">{game.letter}</span>
                </p>
              </div>
            </div>

            {/* Category answer cards */}
            {game.categories.map((category) => (
              <div
                key={category}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20"
              >
                <h3 className="text-white font-bold mb-3 flex items-center gap-2 text-sm">
                  <span className="text-teal-400 font-mono bg-teal-500/20 rounded px-1.5 py-0.5 text-xs">
                    {game.letter}
                  </span>
                  {category}
                </h3>
                <div className="space-y-2">
                  {game.players.map((p) => {
                    const answer = p.answers[category] ?? ''
                    const isRedacted = game.redactedAnswers.some(
                      (r) => r.playerId === p.id && r.category === category,
                    )
                    const isValid =
                      answer.length > 0 &&
                      answer.toUpperCase().startsWith(game.letter?.toUpperCase() ?? '')
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <div className="flex-shrink-0 text-white/50 text-xs w-[4.5rem] truncate">
                          {p.name}
                          {p.id === playerId && (
                            <span className="text-teal-400/70 ml-0.5"> ★</span>
                          )}
                        </div>
                        <div
                          className={`flex-1 text-sm rounded-lg px-3 py-2 min-h-[2.25rem] flex items-center ${
                            isRedacted
                              ? 'bg-red-900/20 text-red-400/50 line-through'
                              : answer.length === 0
                                ? 'bg-white/5 text-white/30 italic'
                                : isValid
                                  ? 'bg-emerald-900/20 text-emerald-300'
                                  : 'bg-red-900/10 text-red-300'
                          }`}
                        >
                          {answer.length === 0 ? '(no answer)' : answer}
                        </div>
                        {answer.length > 0 && (
                          <button
                            onClick={() => handleRedact(p.id, category)}
                            disabled={busy}
                            className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                              isRedacted
                                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            }`}
                          >
                            {isRedacted ? '✓ Restore' : '✕ Redact'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {isHost ? (
              <button
                onClick={handleCalculateScores}
                disabled={busy}
                className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all text-lg shadow-lg shadow-teal-900/30"
              >
                Calculate Scores →
              </button>
            ) : (
              <p className="text-center text-white/40 text-sm">
                Waiting for host to calculate scores…
              </p>
            )}
          </div>
        )}

        {/* ─── FINISHED STATE ─── */}
        {game.status === 'finished' && (
          <div className="space-y-4">
            {/* Winner banner */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 text-center">
              <div className="text-5xl mb-3">🏆</div>
              <h2 className="text-white font-black text-2xl mb-1">Results!</h2>
              {game.winnerId && (
                <p className="text-yellow-300 font-semibold text-lg">
                  {game.winnerId === playerId
                    ? '🎉 You won!'
                    : `🎉 ${game.players.find((p) => p.id === game.winnerId)?.name} wins!`}
                </p>
              )}
            </div>

            {/* Leaderboard */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Leaderboard</div>
              <div className="space-y-2">
                {sortedPlayers.map((p, idx) => {
                  const score = game.finalScores[p.id] ?? 0
                  const medal =
                    idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
                  const isWinner = p.id === game.winnerId
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 rounded-xl p-3 ${
                        isWinner
                          ? 'bg-yellow-500/20 border border-yellow-500/30'
                          : 'bg-white/5'
                      }`}
                    >
                      <span className="text-xl w-8 flex-shrink-0">{medal}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-white font-semibold truncate block">{p.name}</span>
                      </div>
                      {p.id === playerId && (
                        <span className="text-teal-400 text-xs">(you)</span>
                      )}
                      {p.isHost && <span className="text-yellow-400 text-xs">👑</span>}
                      <span
                        className={`font-black text-lg flex-shrink-0 ${isWinner ? 'text-yellow-300' : 'text-white'}`}
                      >
                        {score} pt{score !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Answer summary */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">
                Round Summary — Letter{' '}
                <span className="text-teal-400 font-bold">{game.letter}</span>
              </div>
              {game.categories.map((category) => (
                <div key={category} className="mb-4 last:mb-0">
                  <div className="text-white/70 text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                    <span className="text-teal-400 font-mono bg-teal-500/20 rounded px-1.5 py-0.5">
                      {game.letter}
                    </span>
                    {category}
                  </div>
                  <div className="space-y-1">
                    {game.players.map((p) => {
                      const answer = p.answers[category] ?? ''
                      const isRedacted = game.redactedAnswers.some(
                        (r) => r.playerId === p.id && r.category === category,
                      )
                      const counted =
                        !isRedacted &&
                        answer.length > 0 &&
                        answer.toUpperCase().startsWith(game.letter?.toUpperCase() ?? '')
                      return (
                        <div key={p.id} className="flex items-center gap-2 text-xs">
                          <span className="text-white/40 w-16 truncate flex-shrink-0">
                            {p.name}
                          </span>
                          <span
                            className={`flex-1 ${counted ? 'text-emerald-300' : 'text-white/30'}`}
                          >
                            {answer.length === 0 ? '—' : isRedacted ? '(redacted)' : answer}
                          </span>
                          {counted && (
                            <span className="text-emerald-400 font-bold flex-shrink-0">+1</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {isHost ? (
              <button
                onClick={handlePlayAgain}
                disabled={busy}
                className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all text-lg"
              >
                Play Again
              </button>
            ) : (
              <p className="text-center text-white/40 text-sm">
                Waiting for host to start a new round…
              </p>
            )}

            <Link
              to="/"
              className="block w-full text-center bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/50 hover:text-white/80 text-sm font-medium py-3 rounded-xl transition-all"
            >
              ← Back to Owen's Games
            </Link>
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
