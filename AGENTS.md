# AGENTS.md

## Project Overview

Real-time multiplayer alphabet category game. Players join rooms on their phones and take turns claiming letters by naming something in a given category. A player is eliminated when they can't claim a letter within 20 seconds. Last player standing wins.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19, SSR) |
| Router | TanStack Router v1 (file-based routing) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Storage | Netlify Blobs (strong consistency) |
| Language | TypeScript 5.7 (strict mode) |
| Deployment | Netlify |

## Directory Structure

```
src/
├── routes/
│   ├── __root.tsx          # Root HTML shell, global head/meta
│   ├── index.tsx           # Home page: create or join a game room
│   └── game/
│       └── $roomId.tsx     # Game room: lobby + active game + results screen
├── server/
│   └── game.functions.ts   # All server functions + GameState type
└── styles.css              # Tailwind imports
```

## Key Architecture Decisions

### State Storage: Netlify Blobs (strong consistency)
Game state is one JSON blob per room, keyed by `roomId`, in the `alphabet-game` store. Strong consistency ensures all players see the same state immediately after a write. Blobs was chosen because game state is one self-contained document with no relational queries needed.

### Real-Time via Polling
Netlify serverless functions do not support persistent WebSockets. Clients poll `getGameState` every 1.5 seconds — acceptable latency for a turn-based game with 20-second turns.

### Player Identity
Player IDs are generated server-side at room creation/join time and stored in `sessionStorage` (key: `player-{roomId}`). No auth required — the random ID is the player's credential.

### Turn Management
Active (non-eliminated) players cycle in join order. `currentPlayerIndex` is always modulo the current number of active players. When a player is eliminated, the index is recalculated against the new active list.

### Auto-Elimination
Each client tracks the countdown locally using `turnStartedAt` (a server timestamp). When `remaining === 0` and it is the player's own turn, they call `eliminatePlayer` on themselves. A guard flag prevents duplicate calls.

## Server Functions (src/server/game.functions.ts)

| Function | Method | Description |
|---|---|---|
| `createRoom` | POST | Create a new room; returns `{ roomId, playerId }` |
| `joinRoom` | POST | Add a player to a waiting room |
| `startGame` | POST | Host starts the game (requires ≥2 players) |
| `claimLetter` | POST | Current player claims a letter and advances the turn |
| `eliminatePlayer` | POST | Eliminates the timed-out current player |
| `getGameState` | GET | Returns the full `GameState` for polling |
| `updateCategory` | POST | Host changes the category before game starts |
| `resetGame` | POST | Host resets state for a rematch |

## GameState Shape

```typescript
interface GameState {
  roomId: string
  category: string
  status: 'waiting' | 'playing' | 'finished'
  players: { id: string; name: string; isHost: boolean; isEliminated: boolean }[]
  usedLetters: string[]           // uppercase letters claimed so far
  currentPlayerIndex: number      // index into active (non-eliminated) players
  turnStartedAt: number | null    // Date.now() timestamp when current turn began
  turnTimeLimit: number           // seconds (20)
  loserId: string | null
  winnerId: string | null
}
```

## Coding Conventions

- Components: PascalCase
- Server functions: camelCase, in `src/server/`
- All styling via Tailwind utility classes
- Zod for server function input validation
- `@/` path alias for `src/` imports
- No CSS modules, no component libraries

## Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite plugins: TanStack Start, Netlify, Tailwind |
| `tsconfig.json` | TypeScript with `@/*` alias for `src/*` |
| `netlify.toml` | Build command, publish dir, dev port |
| `package.json` | Dependencies including `@netlify/blobs` |
