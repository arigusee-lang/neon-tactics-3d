# Neon Tactics 3D

`Neon Tactics 3D` is a turn-based tactical prototype built with React, TypeScript, Three.js, and Socket.IO. The project supports solo play, developer sandbox workflows, and an in-progress multiplayer mode.

## Stack

- Frontend: React + Vite + TypeScript
- 3D rendering: `three`, `@react-three/fiber`, `@react-three/drei`
- Backend: Node.js + Express + Socket.IO
- Production runtime: the Node server serves both the built frontend and multiplayer sockets

## Main Entry Points

- [App.tsx](/C:/Users/artur/git/neon-tactics-3d/App.tsx)
- [services/gameService.ts](/C:/Users/artur/git/neon-tactics-3d/services/gameService.ts)
- [server.js](/C:/Users/artur/git/neon-tactics-3d/server.js)
- [components/MainMenu.tsx](/C:/Users/artur/git/neon-tactics-3d/components/MainMenu.tsx)
- [components/RulebookModal.tsx](/C:/Users/artur/git/neon-tactics-3d/components/RulebookModal.tsx)

## Prerequisites

- Node.js 20+
- `npm` on `PATH`
- Windows PowerShell is the primary local environment, though macOS should work too

## Install

```bash
npm install
```

Optional environment:

- If you use the AI-related features, set `GEMINI_API_KEY` in `.env.local`

## Local Development

Run the full local stack with:

```bash
npm run dev
```

This starts:

- Vite dev server on `http://localhost:3000`
- Node/Socket.IO server on `http://localhost:3001`

Keep that terminal open while developing.

## Production Build

Build the frontend:

```bash
npm run build
```

Run the production server locally after building:

```bash
npm run start
```

The production server serves `dist/` and hosts Socket.IO from the same Node process.

## Gameplay Reference

General gameplay rules are documented in the in-app rulebook:

- Open `Rulebook` from the main menu
- Source: [components/RulebookModal.tsx](/C:/Users/artur/git/neon-tactics-3d/components/RulebookModal.tsx)

For unit and action browsing:

- Open `Catalogue` from the main menu

## Multiplayer Notes

- Multiplayer lobby state currently lives in memory on the Node server
- Local development requires the Node server to be running, not just the Vite client
- The current multiplayer map pool is intentionally restricted in code

## Deployment

Production deployment is driven by GitHub Actions:

- Workflow: [.github/workflows/deploy.yml](/C:/Users/artur/git/neon-tactics-3d/.github/workflows/deploy.yml)
- Container build: [Dockerfile](/C:/Users/artur/git/neon-tactics-3d/Dockerfile)

## Repository Notes

- There are currently no formal automated tests in this repo
- `npm run build` is the main verification step used for most changes
