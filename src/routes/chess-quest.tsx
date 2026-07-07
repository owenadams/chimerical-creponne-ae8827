import { createFileRoute, Link } from '@tanstack/react-router'
import {
  BookOpen,
  ChevronLeft,
  Gem,
  Lock,
  Map,
  Music,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

export const Route = createFileRoute('/chess-quest')({
  component: ChessQuest,
})

type AreaId = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'
type View = 'map' | 'lesson' | 'collection' | 'parents'

interface Lesson {
  id: string
  title: string
  prompt: string
  demo: string
  goal: string
  reward: string
  collectible: string
}

interface Area {
  id: AreaId
  name: string
  shortName: string
  character: string
  role: string
  place: string
  palette: string
  button: string
  music: string
  reward: string
  concept: string
  lessons: Lesson[]
  board: {
    piece: string
    targets: number[]
    treats: number[]
    obstacles?: number[]
    pieceStart: number
  }
}

interface ProgressState {
  completedLessons: string[]
  stars: number
  badges: string[]
  collectibles: string[]
  startedAt: number
  secondsPlayed: number
}

const STORAGE_KEY = 'chess-quest-progress'

const AREAS: Area[] = [
  {
    id: 'pawn',
    name: 'Pawn Village',
    shortName: 'Pawn',
    character: 'Penny',
    role: 'small brave explorer',
    place: 'pumpkin paths and apple carts',
    palette: 'from-amber-200 via-lime-200 to-sky-200',
    button: 'bg-amber-400 text-amber-950',
    music: 'gentle bells, ukulele, soft claps',
    reward: 'Pawn Badge',
    concept: 'Penny walks forward one square, then learns a big first step and apple-catching diagonals.',
    lessons: [
      {
        id: 'pawn-walk',
        title: 'Apple Path',
        prompt: 'Tap where Penny should go.',
        demo: 'Penny takes one brave step forward.',
        goal: 'Move forward one square.',
        reward: '3 stars',
        collectible: 'Apple Compass',
      },
      {
        id: 'pawn-two',
        title: 'Big First Step',
        prompt: 'Help Penny make a big first step.',
        demo: 'At the start, Penny can hop two squares.',
        goal: 'Try the two-square first move.',
        reward: 'Treasure chest',
        collectible: 'Pumpkin Boots',
      },
      {
        id: 'pawn-catch',
        title: 'Apple Catch',
        prompt: 'Tap the apple Penny can catch.',
        demo: 'Penny catches treats on a tiny slant.',
        goal: 'Choose a diagonal apple.',
        reward: 'Pawn Badge',
        collectible: 'Penny Card',
      },
    ],
    board: { piece: 'P', pieceStart: 28, targets: [20, 12, 19, 21], treats: [20, 19, 21] },
  },
  {
    id: 'knight',
    name: 'Knight Mountain',
    shortName: 'Knight',
    character: 'Ned',
    role: 'friendly horse who loves jumping',
    place: 'rainbow bridges and sleepy baby dragons',
    palette: 'from-cyan-200 via-blue-200 to-fuchsia-200',
    button: 'bg-cyan-400 text-cyan-950',
    music: 'bouncy drums, hoof taps, mountain flutes',
    reward: 'Knight Badge',
    concept: 'Ned jumps in an L shape and can leap over rocks, rivers and friends.',
    lessons: [
      {
        id: 'knight-jump',
        title: 'Crystal Jump',
        prompt: 'Tap Ned’s treasure jump.',
        demo: 'Ned jumps far, then turns a corner.',
        goal: 'Find an L-shaped jump.',
        reward: '3 stars',
        collectible: 'Blue Crystal',
      },
      {
        id: 'knight-dragon',
        title: 'Dragon Rescue',
        prompt: 'Jump over the rocks.',
        demo: 'Ned can jump right over things.',
        goal: 'Rescue the baby dragon.',
        reward: 'Treasure chest',
        collectible: 'Baby Dragon',
      },
    ],
    board: { piece: 'N', pieceStart: 34, targets: [17, 19, 24, 28], treats: [17, 19], obstacles: [25, 26, 33] },
  },
  {
    id: 'bishop',
    name: 'Bishop Forest',
    shortName: 'Bishop',
    character: 'Bella',
    role: 'magical forest wizard',
    place: 'glowing mushrooms and fairy dust trails',
    palette: 'from-emerald-200 via-teal-100 to-violet-200',
    button: 'bg-emerald-400 text-emerald-950',
    music: 'harp sparkles, wind chimes, forest hums',
    reward: 'Bishop Badge',
    concept: 'Bella glides along glowing diagonal paths through the trees.',
    lessons: [
      {
        id: 'bishop-glide',
        title: 'Fairy Dust Trail',
        prompt: 'Tap Bella’s glowing path.',
        demo: 'Bella slides on a slant through the forest.',
        goal: 'Follow a diagonal path.',
        reward: '3 stars',
        collectible: 'Fairy Lantern',
      },
      {
        id: 'bishop-friend',
        title: 'Forest Friend',
        prompt: 'Glide to the woodland friend.',
        demo: 'Bella stays on her magic slant.',
        goal: 'Reach the diagonal friend.',
        reward: 'Bishop Badge',
        collectible: 'Forest Fox Pin',
      },
    ],
    board: { piece: 'B', pieceStart: 36, targets: [27, 18, 9, 29, 22, 15], treats: [18, 15] },
  },
  {
    id: 'rook',
    name: 'Rook Castle',
    shortName: 'Rook',
    character: 'Rex',
    role: 'cheerful castle guard',
    place: 'tall towers and shiny corridors',
    palette: 'from-rose-200 via-orange-100 to-stone-200',
    button: 'bg-rose-400 text-rose-950',
    music: 'toy trumpets, soft marching drums',
    reward: 'Rook Badge',
    concept: 'Rex patrols straight castle corridors: up, down, left and right.',
    lessons: [
      {
        id: 'rook-patrol',
        title: 'Tower Patrol',
        prompt: 'Tap Rex’s straight path.',
        demo: 'Rex zooms along castle halls.',
        goal: 'Move in a straight line.',
        reward: '3 stars',
        collectible: 'Golden Key',
      },
      {
        id: 'rook-room',
        title: 'Treasure Room',
        prompt: 'Open the treasure room.',
        demo: 'Rex guards rows and towers.',
        goal: 'Choose a row or column.',
        reward: 'Rook Badge',
        collectible: 'Castle Chest',
      },
    ],
    board: { piece: 'R', pieceStart: 35, targets: [3, 11, 19, 27, 32, 33, 34, 36, 37, 38, 39], treats: [3, 32] },
  },
  {
    id: 'queen',
    name: 'Queen Kingdom',
    shortName: 'Queen',
    character: 'Queenie',
    role: 'powerful adventurer',
    place: 'gem gardens and royal rescue balloons',
    palette: 'from-pink-200 via-yellow-100 to-cyan-100',
    button: 'bg-pink-400 text-pink-950',
    music: 'bright strings, twinkles, happy cymbals',
    reward: 'Queen Badge',
    concept: 'Queenie can travel like Bella and Rex: slants and straight paths.',
    lessons: [
      {
        id: 'queen-mix',
        title: 'Royal Rescue',
        prompt: 'Choose any Queenie path.',
        demo: 'Queenie glides and zooms.',
        goal: 'Use straight or diagonal movement.',
        reward: '3 stars',
        collectible: 'Royal Cape',
      },
      {
        id: 'queen-race',
        title: 'Gem Race',
        prompt: 'Race to the shining gem.',
        demo: 'Queenie has lots of helpful paths.',
        goal: 'Find a queen path.',
        reward: 'Queen Badge',
        collectible: 'Moon Gem',
      },
    ],
    board: { piece: 'Q', pieceStart: 36, targets: [0, 4, 8, 12, 20, 27, 28, 29, 30, 31, 35, 37, 38, 39], treats: [0, 4, 31] },
  },
  {
    id: 'king',
    name: "King's Tournament",
    shortName: 'King',
    character: 'Arthur',
    role: 'gentle ruler of Chessland',
    place: 'golden flags and safe castle steps',
    palette: 'from-yellow-200 via-sky-100 to-indigo-200',
    button: 'bg-yellow-400 text-yellow-950',
    music: 'warm horns, little drums, soft choir',
    reward: 'King Badge',
    concept: 'King Arthur takes tiny careful steps and learns to stay away from danger.',
    lessons: [
      {
        id: 'king-step',
        title: 'Tiny Royal Step',
        prompt: 'Tap a safe tiny step.',
        demo: 'Arthur moves one square at a time.',
        goal: 'Move one square.',
        reward: '3 stars',
        collectible: 'Royal Crown',
      },
      {
        id: 'king-safe',
        title: 'Safe Castle',
        prompt: 'Help Arthur reach safety.',
        demo: 'Arthur likes safe squares.',
        goal: 'Step away from danger.',
        reward: 'King Badge',
        collectible: 'Tournament Flag',
      },
    ],
    board: { piece: 'K', pieceStart: 27, targets: [18, 19, 20, 26, 28, 34, 35, 36], treats: [18, 36], obstacles: [10, 12] },
  },
]

const DEFAULT_PROGRESS: ProgressState = {
  completedLessons: [],
  stars: 0,
  badges: [],
  collectibles: [],
  startedAt: Date.now(),
  secondsPlayed: 0,
}

function ChessQuest() {
  const [view, setView] = useState<View>('map')
  const [selectedAreaId, setSelectedAreaId] = useState<AreaId>('pawn')
  const [progress, setProgress] = useState<ProgressState>(DEFAULT_PROGRESS)
  const [loaded, setLoaded] = useState(false)
  const [muted, setMuted] = useState(true)
  const [narrator, setNarrator] = useState(true)
  const [celebration, setCelebration] = useState('')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setProgress({ ...DEFAULT_PROGRESS, ...JSON.parse(stored) })
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  }, [loaded, progress])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => ({ ...current, secondsPlayed: current.secondsPlayed + 10 }))
    }, 10000)
    return () => window.clearInterval(timer)
  }, [])

  const unlockedCount = Math.min(
    AREAS.length,
    1 + Math.floor(progress.completedLessons.length / 2),
  )
  const selectedArea = AREAS.find((area) => area.id === selectedAreaId) ?? AREAS[0]
  const unlockedAreas = AREAS.slice(0, unlockedCount).map((area) => area.id)

  function openArea(area: Area) {
    if (!unlockedAreas.includes(area.id)) return
    setSelectedAreaId(area.id)
    setView('lesson')
  }

  function completeLesson(area: Area, lesson: Lesson) {
    if (progress.completedLessons.includes(lesson.id)) {
      setCelebration(`${area.character} dances again!`)
      window.setTimeout(() => setCelebration(''), 1800)
      return
    }

    const areaLessonIds = area.lessons.map((item) => item.id)
    const completedForArea = progress.completedLessons.filter((id) => areaLessonIds.includes(id)).length
    const earnsBadge = completedForArea + 1 >= area.lessons.length

    setProgress((current) => ({
      ...current,
      completedLessons: [...current.completedLessons, lesson.id],
      stars: current.stars + 3,
      badges: earnsBadge && !current.badges.includes(area.reward) ? [...current.badges, area.reward] : current.badges,
      collectibles: current.collectibles.includes(lesson.collectible)
        ? current.collectibles
        : [...current.collectibles, lesson.collectible],
    }))
    setCelebration(`${lesson.reward}! ${area.character} is so happy!`)
    window.setTimeout(() => setCelebration(''), 2200)
  }

  function resetProgress() {
    setProgress({ ...DEFAULT_PROGRESS, startedAt: Date.now() })
    setSelectedAreaId('pawn')
    setView('map')
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7d8] text-slate-800">
      <div className="fixed inset-0 pointer-events-none chess-quest-sky" />
      {celebration && <Celebration message={celebration} />}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border-4 border-white/80 bg-white/70 p-3 shadow-[0_18px_50px_rgba(70,49,22,0.18)] backdrop-blur">
          <Link
            to="/"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-amber-900 shadow-sm transition hover:scale-[1.02]"
          >
            <ChevronLeft size={20} aria-hidden="true" />
            Games
          </Link>

          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-300 text-3xl shadow-inner">
              ♕
            </div>
            <div>
              <h1 className="font-serif text-3xl font-black leading-none text-amber-950 sm:text-4xl">
                Chess Quest
              </h1>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Adventure through Chessland
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconToggle active={narrator} onClick={() => setNarrator((value) => !value)} label="Narrator">
              <Volume2 size={22} />
            </IconToggle>
            <IconToggle active={!muted} onClick={() => setMuted((value) => !value)} label="Sound">
              {muted ? <VolumeX size={22} /> : <Music size={22} />}
            </IconToggle>
          </div>
        </header>

        <nav className="my-4 grid grid-cols-3 gap-2 sm:mx-auto sm:w-auto sm:grid-cols-3">
          <TabButton active={view === 'map'} onClick={() => setView('map')} icon={<Map size={22} />} label="Map" />
          <TabButton active={view === 'collection'} onClick={() => setView('collection')} icon={<BookOpen size={22} />} label="Book" />
          <TabButton active={view === 'parents'} onClick={() => setView('parents')} icon={<ShieldCheck size={22} />} label="Grown-up" />
        </nav>

        {view === 'map' && (
          <AdventureMap
            areas={AREAS}
            unlockedAreas={unlockedAreas}
            progress={progress}
            onOpenArea={openArea}
          />
        )}

        {view === 'lesson' && (
          <LessonWorld
            area={selectedArea}
            progress={progress}
            narrator={narrator}
            muted={muted}
            onComplete={completeLesson}
            onBack={() => setView('map')}
          />
        )}

        {view === 'collection' && <CollectionBook progress={progress} />}
        {view === 'parents' && (
          <ParentMode
            areas={AREAS}
            progress={progress}
            unlockedCount={unlockedCount}
            onReset={resetProgress}
          />
        )}
      </div>
    </main>
  )
}

function AdventureMap({
  areas,
  unlockedAreas,
  progress,
  onOpenArea,
}: {
  areas: Area[]
  unlockedAreas: AreaId[]
  progress: ProgressState
  onOpenArea: (area: Area) => void
}) {
  return (
    <section className="relative flex-1 rounded-[2.5rem] border-4 border-white bg-[#ffeeb1]/80 p-4 shadow-[0_25px_80px_rgba(92,64,24,0.2)] sm:p-6">
      <div className="absolute inset-x-8 top-1/2 hidden h-3 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#f59e0b_50%,transparent_50%)] bg-[length:28px_8px] opacity-60 sm:block chess-quest-path" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-800">Chessland Map</p>
          <h2 className="font-serif text-3xl font-black text-amber-950 sm:text-5xl">Pick a glowing place</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-3 font-black text-amber-950 shadow-sm">
          <Star className="fill-amber-300 text-amber-500" size={24} />
          {progress.stars}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {areas.map((area, index) => {
          const unlocked = unlockedAreas.includes(area.id)
          const complete = progress.badges.includes(area.reward)
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => onOpenArea(area)}
              className={`group relative min-h-64 overflow-hidden rounded-[2rem] border-4 p-4 text-left shadow-xl transition ${
                unlocked
                  ? 'border-white bg-white hover:-translate-y-1 hover:shadow-2xl'
                  : 'border-white/60 bg-slate-300 grayscale'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${area.palette} opacity-90`} />
              <div className="absolute -right-10 -top-8 h-32 w-32 rounded-full bg-white/50 blur-sm" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-700/70">
                      Stop {index + 1}
                    </p>
                    <h3 className="font-serif text-3xl font-black text-slate-900">{area.name}</h3>
                  </div>
                  {!unlocked ? (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-white/80">
                      <Lock size={24} />
                    </div>
                  ) : complete ? (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-300">
                      <Trophy size={24} />
                    </div>
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-white/80 chess-quest-glow">
                      <Sparkles size={24} />
                    </div>
                  )}
                </div>

                <CharacterFace area={area} large />

                <div>
                  <p className="mb-3 text-sm font-bold text-slate-700">{area.character} is waiting in {area.place}.</p>
                  <span className={`inline-flex min-h-12 items-center rounded-full px-5 font-black shadow ${unlocked ? area.button : 'bg-slate-500 text-white'}`}>
                    {unlocked ? 'Play' : 'Dreaming'}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function LessonWorld({
  area,
  progress,
  narrator,
  muted,
  onComplete,
  onBack,
}: {
  area: Area
  progress: ProgressState
  narrator: boolean
  muted: boolean
  onComplete: (area: Area, lesson: Lesson) => void
  onBack: () => void
}) {
  const [activeLessonId, setActiveLessonId] = useState(area.lessons[0].id)
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null)
  const activeLesson = area.lessons.find((lesson) => lesson.id === activeLessonId) ?? area.lessons[0]
  const completed = progress.completedLessons.includes(activeLesson.id)

  useEffect(() => {
    setActiveLessonId(area.lessons[0].id)
    setSelectedSquare(null)
  }, [area])

  const friendlyReply = selectedSquare === null
    ? activeLesson.demo
    : area.board.targets.includes(selectedSquare)
      ? 'You found a happy path!'
      : "Almost! Let's try another path."

  return (
    <section className={`grid flex-1 gap-4 rounded-[2.5rem] border-4 border-white bg-gradient-to-br ${area.palette} p-4 shadow-[0_25px_80px_rgba(92,64,24,0.2)] lg:grid-cols-[0.9fr_1.2fr]`}>
      <div className="rounded-[2rem] bg-white/75 p-4 shadow-xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-4 font-black text-slate-700 shadow-sm"
        >
          <ChevronLeft size={20} />
          Map
        </button>
        <CharacterFace area={area} large />
        <h2 className="mt-3 font-serif text-4xl font-black text-slate-950">{area.character}</h2>
        <p className="text-lg font-bold text-slate-700">{area.role}</p>

        <div className="my-4 rounded-3xl bg-white p-4 shadow-inner">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Story</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{activeLesson.prompt}</p>
          {narrator && <p className="mt-2 text-sm font-bold text-emerald-700">Narrator says: “{friendlyReply}”</p>}
        </div>

        <div className="rounded-3xl bg-white/80 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-slate-800">
            <Music size={18} />
            Music: {muted ? 'quiet mode' : area.music}
          </p>
        </div>
      </div>

      <div className="rounded-[2rem] bg-white/75 p-4 shadow-xl">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {area.lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              onClick={() => {
                setActiveLessonId(lesson.id)
                setSelectedSquare(null)
              }}
              className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-black shadow-sm ${
                activeLessonId === lesson.id ? area.button : 'bg-white text-slate-700'
              }`}
            >
              {progress.completedLessons.includes(lesson.id) ? '★ ' : ''}
              {lesson.title}
            </button>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
          <ChessBoard
            area={area}
            selectedSquare={selectedSquare}
            onSelectSquare={setSelectedSquare}
          />
          <div className="flex flex-col gap-3">
            <InfoBubble icon={<Sparkles size={22} />} title="Watch">
              {activeLesson.demo}
            </InfoBubble>
            <InfoBubble icon={<Gem size={22} />} title="Try">
              {activeLesson.goal}
            </InfoBubble>
            <InfoBubble icon={<Trophy size={22} />} title="Prize">
              {activeLesson.reward} and {activeLesson.collectible}
            </InfoBubble>
            <button
              type="button"
              onClick={() => onComplete(area, activeLesson)}
              className={`min-h-16 rounded-3xl px-5 text-xl font-black shadow-xl transition active:scale-95 ${area.button}`}
            >
              {completed ? 'Dance Again' : 'I Helped!'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function ChessBoard({
  area,
  selectedSquare,
  onSelectSquare,
}: {
  area: Area
  selectedSquare: number | null
  onSelectSquare: (square: number) => void
}) {
  return (
    <div className="mx-auto grid aspect-square w-full max-w-[34rem] grid-cols-8 overflow-hidden rounded-[1.5rem] border-8 border-amber-900/70 bg-amber-900/70 shadow-2xl">
      {Array.from({ length: 64 }).map((_, square) => {
        const isLight = (Math.floor(square / 8) + square) % 2 === 0
        const isTarget = area.board.targets.includes(square)
        const isTreat = area.board.treats.includes(square)
        const isObstacle = area.board.obstacles?.includes(square)
        const isPiece = area.board.pieceStart === square
        const isSelected = selectedSquare === square
        return (
          <button
            key={square}
            type="button"
            onClick={() => onSelectSquare(square)}
            className={`relative grid place-items-center text-lg font-black transition ${
              isLight ? 'bg-[#ffe7a8]' : 'bg-[#83c67a]'
            } ${isTarget ? 'after:absolute after:inset-2 after:rounded-2xl after:border-4 after:border-white/80' : ''} ${
              isSelected ? 'scale-95 brightness-110' : ''
            }`}
          >
            {isTarget && <span className="absolute h-4 w-4 rounded-full bg-white/90 chess-quest-pulse" />}
            {isObstacle && <span className="text-2xl">◆</span>}
            {isTreat && <span className="text-2xl">{area.id === 'knight' ? '✦' : area.id === 'king' ? '♛' : '●'}</span>}
            {isPiece && (
              <span className="relative z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-2xl text-amber-950 shadow-lg sm:h-14 sm:w-14 sm:text-3xl chess-quest-bob">
                {area.board.piece}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function CollectionBook({ progress }: { progress: ProgressState }) {
  const allCollectibles = AREAS.flatMap((area) => area.lessons.map((lesson) => ({ ...lesson, area })))
  return (
    <section className="flex-1 rounded-[2.5rem] border-4 border-white bg-white/75 p-5 shadow-[0_25px_80px_rgba(92,64,24,0.2)]">
      <h2 className="font-serif text-4xl font-black text-amber-950">Collection Book</h2>
      <p className="mb-5 text-lg font-bold text-emerald-700">Stickers, friends and magical treasures live here.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {allCollectibles.map(({ collectible, area }) => {
          const unlocked = progress.collectibles.includes(collectible)
          return (
            <div
              key={collectible}
              className={`min-h-44 rounded-[1.5rem] border-4 border-white p-4 shadow-lg ${
                unlocked ? `bg-gradient-to-br ${area.palette}` : 'bg-slate-200 text-slate-400 grayscale'
              }`}
            >
              <CharacterFace area={area} />
              <h3 className="mt-3 text-xl font-black">{unlocked ? collectible : 'Mystery Sticker'}</h3>
              <p className="text-sm font-bold">{unlocked ? area.name : 'Keep adventuring.'}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ParentMode({
  areas,
  progress,
  unlockedCount,
  onReset,
}: {
  areas: Area[]
  progress: ProgressState
  unlockedCount: number
  onReset: () => void
}) {
  const minutes = Math.floor(progress.secondsPlayed / 60)
  const concepts = areas
    .filter((area) => area.lessons.some((lesson) => progress.completedLessons.includes(lesson.id)))
    .map((area) => area.concept)

  return (
    <section className="flex-1 rounded-[2.5rem] border-4 border-white bg-white/80 p-5 shadow-[0_25px_80px_rgba(92,64,24,0.2)]">
      <h2 className="font-serif text-4xl font-black text-amber-950">Grown-up View</h2>
      <p className="mb-5 font-bold text-slate-600">A quick, no-setup progress snapshot for Chess Quest.</p>
      <div className="grid gap-3 md:grid-cols-5">
        <Stat label="Lessons" value={`${progress.completedLessons.length}`} />
        <Stat label="Stars" value={`${progress.stars}`} />
        <Stat label="Badges" value={`${progress.badges.length}`} />
        <Stat label="Areas" value={`${unlockedCount}/6`} />
        <Stat label="Minutes" value={`${minutes}`} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.5rem] bg-amber-100 p-4">
          <h3 className="text-xl font-black text-amber-950">Concepts introduced</h3>
          <div className="mt-3 space-y-2">
            {(concepts.length ? concepts : ['Pawn Village is ready to begin.']).map((concept) => (
              <p key={concept} className="rounded-2xl bg-white p-3 text-sm font-bold text-slate-700">
                {concept}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-[1.5rem] bg-emerald-100 p-4">
          <h3 className="text-xl font-black text-emerald-950">Unlocked rewards</h3>
          <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700">
            {progress.badges.length ? progress.badges.join(', ') : 'No badges yet.'}
          </p>
          <button
            type="button"
            onClick={onReset}
            className="mt-4 min-h-12 rounded-full bg-white px-5 font-black text-slate-700 shadow-sm"
          >
            Reset local progress
          </button>
        </div>
      </div>
    </section>
  )
}

function CharacterFace({ area, large = false }: { area: Area; large?: boolean }) {
  const symbol = area.board.piece
  return (
    <div className={`${large ? 'h-36 w-36 text-6xl' : 'h-20 w-20 text-4xl'} chess-quest-bob relative grid place-items-center rounded-[38%_44%_42%_36%] bg-white shadow-xl`}>
      <div className="absolute left-1/2 top-3 h-5 w-12 -translate-x-1/2 rounded-full bg-amber-200" />
      <span className="relative z-10 font-serif font-black text-amber-950">{symbol}</span>
      <span className="absolute bottom-9 left-1/2 h-2 w-10 -translate-x-1/2 rounded-full bg-rose-300" />
      <span className="absolute left-1/2 top-1/2 flex w-16 -translate-x-1/2 -translate-y-1/2 justify-between">
        <span className="h-3 w-3 rounded-full bg-slate-900" />
        <span className="h-3 w-3 rounded-full bg-slate-900" />
      </span>
    </div>
  )
}

function InfoBubble({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-amber-700">
        {icon}
        {title}
      </p>
      <p className="text-lg font-black text-slate-800">{children}</p>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-4 text-sm font-black shadow-sm transition ${
        active ? 'bg-amber-400 text-amber-950' : 'bg-white/80 text-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function IconToggle({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-12 w-12 place-items-center rounded-full shadow-sm transition ${
        active ? 'bg-emerald-300 text-emerald-950' : 'bg-white text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] bg-amber-100 p-4 text-center">
      <p className="text-3xl font-black text-amber-950">{value}</p>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">{label}</p>
    </div>
  )
}

function Celebration({ message }: { message: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-amber-100/20 backdrop-blur-[1px]">
      <div className="relative rounded-[2rem] border-4 border-white bg-white px-8 py-6 text-center shadow-2xl chess-quest-pop">
        <div className="absolute -inset-10 bg-[radial-gradient(circle,#facc15_0_10%,transparent_11%),radial-gradient(circle,#38bdf8_0_10%,transparent_11%),radial-gradient(circle,#fb7185_0_10%,transparent_11%)] bg-[length:42px_42px] opacity-70 chess-quest-spin" />
        <div className="relative">
          <Sparkles className="mx-auto mb-2 fill-amber-300 text-amber-500" size={42} />
          <p className="text-2xl font-black text-amber-950">{message}</p>
        </div>
      </div>
    </div>
  )
}
