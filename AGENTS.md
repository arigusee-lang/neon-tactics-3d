# AGENTS.md

This file is for coding agents working in this repository. It documents the current setup and the expected behavior when collaborating with the repo owner and a non-technical product owner.

## Project Intent

- This is a vibecoded game project. Keep momentum high, but do not hide uncertainty.
- Primary developer environment is Windows.
- macOS is occasional and should be supported as a secondary environment.
- The repo has two real users:
- The owner is a software engineer and can handle direct technical detail.
- The product owner is non-technical and needs simple, safe instructions.
- Prefer the clean, obvious workflow over clever workarounds.
- If the environment is missing required access, permissions, tools, or PATH configuration, stop and ask. Do not keep burning time on hacks like repeatedly hardcoding full executable paths.

## Ground Rules For Agents

- Inspect the real repo state before making claims.
- Default to Windows-friendly instructions and commands when giving operational guidance.
- If a command or workflow is OS-sensitive, say so explicitly and provide the macOS variant only when useful.
- Use the existing scripts and pipeline. Do not invent replacement workflows unless explicitly asked.
- If `npm`, `git`, `gcloud`, or similar tools are installed but unavailable because the environment is misconfigured, ask the user to fix PATH or restart the terminal/session. Do not normalize a broken shell by repeatedly using absolute executable paths.
- On Windows, if an agent must launch `npm` in a detached/background process from PowerShell, use `npm.cmd` or `cmd.exe /c npm ...`; `Start-Process npm` can fail because `npm` is a `.cmd` shim rather than a native executable.
- Installing project dependencies is allowed when needed.
- If a command requires elevated access or a less restricted environment, ask for it instead of finding a workaround.
- This repo currently has no unit tests or formal quality gates. Do not claim test coverage that does not exist.
- Do not silently “improve” build, run, or deploy flows during unrelated tasks. Document gaps and ask first.

## Current Repo Shape

- Frontend: React + Vite + TypeScript.
- 3D/game UI: `three`, `@react-three/fiber`, `@react-three/drei`.
- Backend: `server.js` with Express + Socket.IO.
- Production runtime: Node serves the built Vite app from `dist/` and hosts the Socket.IO server from the same process.
- Local development: Vite dev server and Node/socket server run as two separate processes behind one command.

Important files:

- `package.json`: source of truth for dev/build/start commands.
- `vite.config.ts`: Vite dev server on port `3000`, host `0.0.0.0`.
- `server.js`: Express + Socket.IO server on port `3001` locally, or `process.env.PORT` in production.
- `services/gameService.ts`: client-side game state service and Socket.IO client connection logic.
- `App.tsx`: top-level app wiring.
- `.github/workflows/deploy.yml`: production deploy pipeline.
- `Dockerfile`: production container build used by Cloud Run deploys.
- `DEPLOYMENT.md`: older deployment notes; useful background, but not the final source of truth when it conflicts with the workflow.
- `app.yaml`: present in repo, but current production deployment is documented by the Cloud Run GitHub workflow and Dockerfile.

## Launch Settings Reality

- There is no committed `.vscode/launch.json` in this repo right now.
- `.vscode/settings.json` exists, but it is not a run configuration.
- There are JetBrains project files in `.idea/`, but no committed project-level launch instructions should be treated as the source of truth.
- The real launch instructions come from `package.json`.

## Install

Prerequisite:

- Node.js 20+ is the safe assumption because the Dockerfile uses `node:20-slim`.
- Assume the shell is PowerShell on Windows unless the user says otherwise.

Install dependencies:

```bash
npm install
```

Environment:

- The client reads `GEMINI_API_KEY` from `.env.local`.
- Vite exposes that value through `vite.config.ts`.
- There are currently no repo-managed secrets that should be copied into documentation.

## Local Development

Primary command:

```bash
npm run dev
```

What it does:

- Starts the Vite client watcher on `http://localhost:3000`.
- Starts `nodemon server.js` on `http://localhost:3001`.
- Keeps running because both processes are watchers. This is expected behavior, not a hung command.

Rules for agents:

- Do not treat `npm run dev` as a command that should finish.
- Do not run `npm run dev` in the only interactive terminal and then get stuck waiting for completion.
- If you need the dev stack running while continuing work, use one of these clean options:
- Ask the user to open a second terminal and run `npm run dev`.
- Run it in a clearly managed detached/background process if your environment supports that cleanly.
- If your environment cannot safely keep a long-running process alive, stop and ask instead of improvising.
- If the app starts and the expected ports bind, failure to auto-open a browser window is an environment/tooling limitation, not an app startup failure.
- Do not replace `npm run dev` with custom wrapper scripts unless the user explicitly asks for repo changes.

Notes for human operators:

- Hot reload is available through Vite. Frontend changes should rebuild automatically while `npm run dev` is running.
- Server changes under `server.js` are watched by `nodemon` and will restart automatically.
- If a product owner only needs the app running locally, the simplest instruction is: open a terminal in the repo, run `npm install` once, then run `npm run dev`, then leave that terminal open.
- On Windows, prefer PowerShell or an IDE terminal with Node available on PATH.
- On macOS, the same npm commands should work, but do not assume Windows-specific terminal behavior.

## Build

Production build:

```bash
npm run build
```

Current behavior:

- Builds the frontend into `dist/`.
- Does not bundle the Node server; `server.js` remains the production entrypoint.
- Build currently succeeds, but Vite warns that the main client chunk is large.

## Production Run

Use this after building:

```bash
npm run start
```

What it does:

- Runs `node server.js`.
- Serves static assets from `dist/`.
- Serves the SPA entry for normal browser routes.
- Hosts Socket.IO on the same server process.

Port behavior:

- Local default is `3001`.
- Production uses `process.env.PORT` when provided by the hosting platform.

## How Client And Server Are Wired

Client:

- The frontend is a Vite React app.
- `App.tsx` subscribes to the singleton `gameService`.
- `services/gameService.ts` owns most game state and gameplay orchestration.
- The client connects to Socket.IO at:
- `http://localhost:3001` when `window.location.hostname === 'localhost'`
- `/` in production, which works because the Node server serves both the app and Socket.IO

Server:

- `server.js` creates an Express app and wraps it with an HTTP server plus Socket.IO.
- The server keeps lobby state in memory.
- It handles lobby creation/join, authoritative command relays, turn gating, and disconnect cleanup.
- There is a `/health` endpoint.
- There is no persistent database in the current architecture.

Multiplayer model:

- Lobby state is in-memory only.
- Multiplayer actions are partly server-authoritative through `authoritative_command_request`.
- Some actions are still relayed through a simpler `game_action` channel.
- This means local dev and prod behavior both depend on the Node server being up, not just the Vite client.

## Deploy

Production deployment exists in GitHub Actions:

- Workflow file: `.github/workflows/deploy.yml`
- Triggered on pushes to `main` and by manual workflow dispatch.
- Target platform: Google Cloud Run.
- Container registry: Google Artifact Registry.
- The workflow builds a Docker image, pushes it, then deploys it to the Cloud Run service.

High-level deploy paths supported today:

- Manual deploy from a local machine using GCP tooling.
- Automated deploy from GitHub Actions.

Agent rules for deploy work:

- Treat GitHub Actions as the canonical shared deploy path.
- If deploy docs conflict, trust `.github/workflows/deploy.yml` over older markdown notes.
- If asked to deploy manually, prefer using the existing GCP CLI flow rather than inventing a new one.
- If `gcloud` access, auth, or permissions are missing, ask the user to fix access instead of substituting a different deploy path.

## Working Style In This Repo

- Favor small, explicit changes over framework churn.
- Preserve the current architecture unless the user asks for a larger refactor.
- When documenting or explaining run steps, keep one obvious path for the product owner.
- When giving commands to a non-technical user, prefer exact copy-paste commands and say when a terminal must remain open.
- When a task depends on the dev server continuing to run, say that clearly.
- If you discover repo friction that should be improved, put recommendations in a separate markdown file or raise them in chat. Do not fold speculative improvements into this file unless asked.

## OS Expectations

- Windows is the default operating environment for this repo.
- macOS support matters, but it is secondary.
- Prefer cross-platform npm scripts over shell-specific one-liners.
- If a proposed command behaves differently on Windows and macOS, call that out before asking the user to run it.
- Do not assume bash-only helpers are acceptable for local workflow documentation.

## Safe Operator Instructions

For someone who only needs the game running locally:

1. Open a terminal in the repo.
2. Run `npm install` once.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.
5. Keep that terminal open while working.

If the command window is needed for something else:

1. Open a second terminal for the repo.
2. Leave `npm run dev` running there.

## What Not To Do

- Do not assume a missing launch profile means the project cannot run.
- Do not keep retrying broken shell commands with hardcoded executable paths.
- Do not treat watch mode as a crash just because the command stays open.
- Do not create ad hoc helper scripts just to avoid asking a straightforward permission or environment question.
- Do not claim there is staging, automated testing, or secret management here when there is not.
