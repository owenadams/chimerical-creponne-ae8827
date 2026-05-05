import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { createRoom, joinRoom } from '@/server/game.functions'

export const Route = createFileRoute('/alphabet')({
  component: AlphabetHome,
})

const SUGGESTED_CATEGORIES = [
  'Animals',
  'Things that are blue',
  'Things you take on holiday',
  'Foods',
  'Countries',
  'Sports',
  'Movies',
  'Things in a kitchen',
  'Jobs/Professions',
  'Things that are round',
]

function AlphabetHome() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'create' | 'join'>('create')

  // Create game state
  const [hostName, setHostName] = useState('')
  const [category, setCategory] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Join game state
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!hostName.trim() || !category.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const result = await createRoom({ data: { hostName: hostName.trim(), category: category.trim() } })
      sessionStorage.setItem(`player-${result.roomId}`, result.playerId)
      navigate({ to: '/game/$roomId', params: { roomId: result.roomId } })
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
      const result = await joinRoom({ data: { roomId: code, playerName: playerName.trim() } })
      sessionStorage.setItem(`player-${code}`, result.playerId)
      navigate({ to: '/game/$roomId', params: { roomId: code } })
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

        {/* Title */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🔤</div>
          <h1 className="text-4xl font-black text-white tracking-tight">Alphabet Game</h1>
          <p className="text-purple-300 mt-2 text-sm">
            Name something in the category using each letter — run out and you're out!
          </p>
        </div>

        {/* Tab switcher */}
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

        {/* Create form */}
        {tab === 'create' && (
          <form onSubmit={handleCreate} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-4 border border-white/20">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-1.5">Your name</label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Enter your name"
                maxLength={30}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm font-medium mb-1.5">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Animals, Things that are blue"
                maxLength={100}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all"
                required
              />
              {/* Suggestions */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className="text-xs bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/15 rounded-full px-2.5 py-1 transition-all"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <button
              type="submit"
              disabled={creating || !hostName.trim() || !category.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-900/50 text-lg"
            >
              {creating ? 'Creating…' : 'Create Room'}
            </button>
          </form>
        )}

        {/* Join form */}
        {tab === 'join' && (
          <form onSubmit={handleJoin} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 space-y-4 border border-white/20">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-1.5">Your name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={30}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all"
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
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all uppercase font-mono tracking-widest text-center text-xl"
                required
              />
            </div>
            {joinError && <p className="text-red-400 text-sm">{joinError}</p>}
            <button
              type="submit"
              disabled={joining || !playerName.trim() || roomCode.length < 6}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-900/50 text-lg"
            >
              {joining ? 'Joining…' : 'Join Room'}
            </button>
          </form>
        )}

        <p className="text-center text-white/30 text-xs mt-6">Share the room code with friends to play together</p>
      </div>
    </div>
  )
}
