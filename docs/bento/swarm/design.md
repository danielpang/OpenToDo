# Swarm Design Note — ToDo App MVP

## Goal
Build a Trello-like clone in `/workspace/OpenToDo` with a fun, creative, beautiful & practical UI. Boards → Lists → Cards, drag-and-drop reorder/move, persistent storage. Single shared workspace, **no authentication** in the MVP (deliberate, reversible; multi-user is a future leaf).

The full leaf decomposition and per-leaf "finished means" live in `PLAN.md` (committed to `swarm/todo-app-mvp`). This note states the *architecture decisions* every agent must share.

## Stack (engineering decision)
A modern web app is the right tool here — it delivers a beautiful UI with real drag-and-drop. Fallback (only if a toolchain genuinely cannot be provisioned): a zero-build static app (vanilla HTML/CSS/ESM JS) using `localStorage` or a small single-file server.

### Server (`/server`)
- Node + TypeScript + Express + **better-sqlite3** (real on-disk persistence; on tests, `:memory:`). Install `sqlite3` if the native build fails for some arch.
- File-based migrations in `schema.sql`, run idempotently on startup. DB at `server/data/todo.db` (gitignored).
- REST API at `/api/...`, versioned by convention (no `/v1` prefix needed for MVP). CORS-enabled + a validation error handler (`400 {error}`, `404` on unknown id, `500` logged).
- Tests: Vitest + supertest, co-located with each route.

### Client (`/client`)
- React 18 + TypeScript + Vite + Tailwind CSS + React Router v6 + `@hello-pangea/dnd` (the maintained fork of `react-beautiful-dnd`).
- Typed `fetch` wrapper in `api/client.ts` targeting `/api`. DTOs mirrored in `client/src/types.ts` — **mirrors** `server/docs/api.md`, not the server code (separate files, agree by convention).
- Theme: `theme.ts` (palette + motion tokens, dark/light), `styles/index.css`. Not generic: distinct primary/accent, "fun but not gaudy" surfaces, at least one spring motion token used in the shell.
- Tests: Vitest + Testing Library + jsdom.

### Tooling
- Root `package.json` = npm workspaces (`client` + `server`). One `npm install`. Root scripts: `dev` (server `tsx` watch + Vite), `build` (both tiers), `lint`, `test`, plus `e2e` (added by L6).
- Vite proxies `/api` → server in dev (no CORS during local dev).

## Dependency order (merge queue lands one branch at a time)
L0 scaffold → L1 backend-db → L2 backend-api → F1 frontend-core → { L3 frontend-boards, L4 frontend-boardview, L5 ci } (concurrent-safe, disjoint files) → L6 integration.

## Branching
- Every leaf = one branch `leaf/<slug>` off `swarm/todo-app-mvp`. Workers do **not** merge/push/PR — the merge queue lands each.
- A worker must not edit another leaf's files; flag plan corrections to the planner instead.
- "Finished" = the acceptance bar in the leaf description (tests green, TS/lint clean, behavior matches contract).

## Environment
Sandbox had no Node initially; `apt-get` + `registry.npmjs.org` are reachable, so L0 installs and verifies the toolchain before anything else.

## Files owned per leaf (no overlap — concurrent leaves touch disjoint paths)
- L0: root configs + `server/src/index.ts` + `client/` scaffold.
- L1: `server/src/db/*`, `server/src/models/repos.ts` (+ extends `index.ts` for DB init).
- L2: `server/src/routes/*`, `server/docs/api.md` (+ extends `index.ts` for router mount + cors).
- F1: `client/src/types.ts`, `api/client.ts`, `styles/*`, `theme.ts`, `components/Layout.tsx`, `App.tsx`, `pages/*.tsx` stubs, `vitest.setup.ts`.
- L3: replaces `pages/BoardsPage.tsx` + `BoardCard`, `NewBoardDialog`, test.
- L4: replaces `pages/BoardView.tsx` + `CardForm`, `CardDetail`, `ListColumn`, test.
- L5: `.github/workflows/ci.yml` only.
- L6: `README.md`, `scripts/e2e.mjs`, root `package.json` `e2e` script.
