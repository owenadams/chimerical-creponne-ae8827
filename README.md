# Alphabet Game

A real-time multiplayer word game playable on mobile. Players join a shared room and take turns naming things in a given category — each answer must start with a different letter of the alphabet. Run out of time and you're eliminated!

## How to Play

1. One player creates a room and picks a category (e.g. "Animals", "Things that are blue")
2. Other players join using the 6-character room code on their phones
3. The host starts the game
4. On your turn, say something in the category out loud — then tap the first letter of your answer before the 20-second timer runs out
5. Used letters are locked — no one else can use them
6. If you can't think of something (or run out of time), you're eliminated
7. Last player standing wins!

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19, SSR) |
| Router | TanStack Router v1 (file-based) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Storage | Netlify Blobs (shared game state with strong consistency) |
| Language | TypeScript 5.7 (strict) |
| Deployment | Netlify |

## Running Locally

```bash
npm install
netlify dev   # starts dev server at http://localhost:8888
```

> **Note:** Netlify Blobs requires a deployed Netlify site for local development. Run `netlify link` to connect to your site, then `netlify dev` will configure Blobs automatically.

## Environment Variables

No API keys are required for the games. Netlify Blobs is provisioned automatically on Netlify.

For the private Gmail Assistant section, configure:

- `OWNER_SECTION_PASSWORD`: Password used on `/owner-login`
- `OWNER_SESSION_SECRET`: Extra secret used to sign the auth cookie (set this to a long random string)
