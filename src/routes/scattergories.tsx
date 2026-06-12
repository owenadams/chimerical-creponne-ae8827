import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  createScattergoriesRoom,
  joinScattergoriesRoom,
} from '@/server/scattergories.functions'

export const Route = createFileRoute('/scattergories')({
  component: ScattergoriesHome,
})

function ScattergoriesHome() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'create' | 'join'>('create')

  const [hostName, setHostName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!hostName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const result = await createScattergoriesRoom({ data: { hostName: hostName.trim() } })
      sessionStorage.setItem(`scattergories-player-${result.roomId}`, result.playerId)
      navigate({ to: '/scattergories/$roomId', params: { roomId: result.roomId } })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create room')
      setCreating(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!playerName.trim() || !roomCode.trim()) return
    setJoining(true)
    setJoinError('')
    try {
      const code = roomCode.trim().toUpperCase()
      const result = await joinScattergoriesRoom({
        data: { roomId: code, playerName: playerName.trim() },
      })
      sessionStorage.setItem(`scattergories-player-${code}`, result.playerId)
      navigate({ to: '/scattergories/$roomId', params: { roomId: code } })
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join room')
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-4 transition-colors"
        >
          <span aria-hidden="true">←</span> Owen's Games
        </Link>

        <div className="text-center mb-8">
          <div className="text-6xl mb-3">📝</div>
          <h1 className="text-4xl font-black text-white tracking-tight">Scattergories</h1>
          <p className="text-teal-300 mt-2 text-sm">
            Roll a letter, then name something in each category — before the timer runs out!
          </p>
        </div>

        <div className="flex bg-white/10 rounded-xl p-1 mb-6 backdrop-blur-sm">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'create' ? 'bg-white text-indigo-900 shadow-md' : 'text-white/70 hover:text-white'
            }`}
          >
            Create Game
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'join' ? 'bg-white text-indigo-900 shadow-md' : 'text-white/70 hover:text-white'
            }`}
          >
            Join Game
          </button>
        </div>

        {tab === 'create' && (
          <form
            onSubmit={handleCreate}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-4 border border-white/20"
          >
            <div>
              <label className="block text-white/80 text-sm font-medium mb-1.5">Your name</label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Enter your name"
                maxLength={30}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-teal-400 focus:bg-white/15 transition-all"
                required
              />
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <button
              type="submit"
              disabled={creating || !hostName.trim()}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-teal-900/50 text-lg"
            >
              {creating ? 'Creating…' : 'Create Room'}
            </button>
          </form>
        )}

        {tab === 'join' && (
          <form
            onSubmit={handleJoin}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-4 border border-white/20"
          >
            <div>
              <label className="block text-white/80 text-sm font-medium mb-1.5">Your name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={30}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-teal-400 focus:bg-white/15 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm font-medium mb-1.5">Room code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. AB12CD"
                maxLength={6}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-teal-400 focus:bg-white/15 transition-all uppercase font-mono tracking-widest text-center text-xl"
                required
              />
            </div>
            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            <button
              type="submit"
              disabled={joining || !playerName.trim() || roomCode.length < 6}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-teal-900/50 text-lg"
            >
              {joining ? 'Joining…' : 'Join Room'}
            </button>
          </form>
        )}

        <p className="text-center text-white/30 text-xs mt-6">
          Share the room code with friends to play together
        </p>
      </div>
    </div>
  )
}
