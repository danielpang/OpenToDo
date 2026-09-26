# Swarm Design Note — ToDo App MVP

## Goal
Build a Trello-like clone in `/workspace/OpenToDo` with a fun, creative, beautiful & practical UI. Boards → Lists → Cards, drag-and-drop reorder/move, persistent storage. Single shared workspace, **no authentication** in the MVP (deliberate, reversible; multi-user is a future leaf).

The full leaf decomposition and per-leaf "finished means" live in `PLAN.md` (committed to `swarm/todo-app-mvp`). This note states the *architecture decisions* every agent must share.

## Stack (engineering decision)
A modern web app is the right tool — beautiful UI with real drag-and-drop. Node + npm are already present in the sandbox (v18.19.1 / npm 9.2.0); `registry.npmjs.org` is reachable; `better-sqlite3` native prebuilts install on arm64 (verified). Fallback (only if a toolchain genuinely cannot be provisioned): a zero-build static app (vanilla HTML/CSS/ESM JS) using `localStorage`.

### Server (`/server`)
- Node + TypeScript + Express + **better-sqlite3** (on-disk persistence; `:memory:` in tests).
- File-based migrations in `schema.sql`, run idempotently on startup. DB at `server/data/todo.db` (gitignored).
- REST API at `/api/...` + `GET /api/health` -> `200 { ok: true }`. CORS-enabled + validation error handler (`400 {error}`, `404` on unknown id, `500` logged).
- Tests: Vitest + supertest, co-located with each route.

### Client (`/client`)
- React 18 + TypeScript + Vite + Tailwind CSS + React Router v6 + `@hello-pangea/dnd`.
- Typed `fetch` wrapper in `api/client.ts` targeting `/api`. DTOs mirrored in `client/src/types.ts` — **mirrors** `server/docs/api.md`, not the server code (separate files, agree by convention).
- Theme: `theme.ts` (palette + motion tokens, dark/light), `styles/index.css`. Not generic: distinct primary/accent, "fun but not gaudy" surfaces, at least one spring motion token used in the shell.
- Tests: Vitest + Testing Library + jsdom.

### Tooling
- Root `package.json` = npm workspaces (`client` + `server`). One `npm install`. Root scripts: `dev` (server `tsx` watch + Vite), `build` (both tiers), `lint`, `test`, plus `e2e` (added by L6).
- Vite proxies `/api` → server in dev (no CORS during local dev).

## Planner correction — L0 split into L0a + L0b
The single L0 scaffold leaf **failed with no output** (the agent produced zero code and no report). Re-assigning the same weight-30, two-tier leaf risks the same result. Per the planning rules (a leaf nobody could finish in a sitting is a group to split further), L0 is split into two sequential leaves, each sized to finish in one sitting:

- **L0a — Root + Server scaffold** (depends on nothing): npm workspaces + root configs, server package/tsconfig, `server/src/index.ts` (+ `/api/health`), server placeholder test. Finished = Node verified, root install installs server, `npm run build`/`lint`/`test` green for server, `/api/health` returns 200 `{ok:true}`. **L0a is assigned FIRST.**
- **L0b — Client scaffold** (depends on L0a — both extend root `package.json`): client package/tsconfig/vite(tw+tailwind)+index.html+main/App/Layout+router-shell-with-stubs+theme+placeholder test+CONTRIBUTING, and extends root scripts so `build`/`dev`/`test` cover BOTH tiers. Finished = both tiers build with zero TS/lint errors, `/api/health` 200 + UI at :5173 proxied, root `npm test` green for both, theme exists with a motion token used in shell.

The original L0 acceptance (build/dev/test across both tiers) is satisfied once both L0a and L0b have landed.

## Dependency order (merge queue lands one branch at a time)
`L0a → L0b`; meanwhile **`L1` can start after L0a`** (it needs only the server scaffold, not the client), so the backend track is no longer blocked by the client scaffold. Corrected DAG:

```
L0a (root+server) ──► L0b (client)
       │                  │
       ▼                  ▼
     L1 (db+repos)      F1 waits on L2
       │
       ▼
    L2 (rest api) ──► F1 (frontend core: types/client/theme/layout/router)
                         │
            ┌────────────┼──────────────┐
            ▼            ▼               ▼
          L3 (boards)  L4 (board view+DnD)  L5 (CI)   [concurrent-safe, disjoint files]
            │            │               │
            └────────────┴───────────────┘
                       ▼
                     L6 (integration: README + e2e)
```

Concurrency (disjoint file sets): `{L1, L0b}` after L0a; `{L3, L4, L5}` after F1; `L6` alone at the end. Sequential chains (shared bootstrap files): L0a→L0b, L0b→F1, L1→L2, L2→F1.

## Branching
- Every leaf = one branch `leaf/<slug>` off `swarm/todo-app-mvp` (planner pre-bases each on the latest merged tip). Workers do **not** merge/push/PR — the queue lands each.
- A worker must not edit another leaf's files; flag plan corrections to the planner.
- "Finished" = the acceptance bar in the leaf description (tests green, TS/lint clean, behavior matches contract).

## Files owned per leaf (no overlap within a concurrent group)
- L0a: root configs + server scaffold (no client files).
- L0b: all `client/` + CONTRIBUTING + extends root scripts.
- L1: `server/src/db/*`, `server/src/models/repos.ts` (+ extends `server/src/index.ts` for DB init — sequential after L0a).
- L2: `server/src/routes/*`, `server/docs/api.md` (+ extends `server/src/index.ts` for router mount + cors).
- F1: `client/src/types.ts`, `api/client.ts`, `styles/*`, `theme.ts`, `components/Layout.tsx`, `App.tsx`, `pages/*.tsx` stubs, `vitest.setup.ts`.
- L3: replaces `pages/BoardsPage.tsx` + `BoardCard`, `NewBoardDialog`, test.
- L4: replaces `pages/BoardView.tsx` + `CardForm`, `CardDetail`, `ListColumn`, test.
- L5: `.github/workflows/ci.yml` only.
- L6: `README.md`, `scripts/e2e.mjs`, root `package.json` `e2e` script.

## Environment
Node v18.19.1 + npm 9.2.0 present; registry reachable; better-sqlite3 native prebuilts verified working on arm64. Lint note: the repo currently has no eslint/prettier installed — L0a brings them in.