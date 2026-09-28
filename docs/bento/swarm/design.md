# Swarm Design Note — ToDo App MVP

## Goal
Trello-like clone in `/workspace/OpenToDo`: Boards → Lists → Cards, drag-and-drop reorder/move, persistent storage, no auth (single shared workspace). Fun, beautiful, practical UI. Per-leaf "finished means" live in the task tree; this note carries stack, environment, and planner corrections.

## ⚠️ Environment correction (Node version)
The sandbox Node is **v22.22.2** (NODE_MODULE_VERSION 127), arm64/linux. There is **no `python`, `gcc`/`g++`, or `make`** — so every native module MUST come from an npm prebuilt; there is **no source-build fallback**. `registry.npmjs.org` is reachable. ⚠️ The earlier note's "Node v18.19.1 + npm 9.2.0" was an incorrect read of this sandbox — Node 18 is **not** installed here. (Node is a sandbox given, not a user/product decision.)

## Stack
- **Server**: Node v22.22.2 + npm 10.9.7, Express + TypeScript + **better-sqlite3 ^13** (v13.0.3; declares `engines.node>=22`; ships a Node-22/arm64 prebuilt that installs & loads — verified on this sandbox). on-disk DB at `server/data/todo.db`; `:memory:` in tests. REST at `/api/...`. Tests: Vitest + supertest, co-located.
- **Client**: React 18 + TS + Vite + Tailwind + React Router v6 + `@hello-pangea/dnd`. Tests: Vitest + Testing Library + jsdom.
- Root `package.json` = npm workspaces (`server` now; `client` added by L0b). Root scripts `dev/build/lint/test` run both tiers; `e2e` added by L6. Vite proxies `/api`→server in dev.

## ⚠️ Planner correction — L0a retry 2 (better-sqlite3 version)
The first L0a retry pinned **better-sqlite3 ^9**, reasoning from the (false) assumption that the sandbox was Node 18 (where v9.6.0 has a prebuilt). That premise is wrong: the sandbox is **Node 22**, and **better-sqlite3 ^9.6.0 has no Node-22/arm64 prebuilt** (v9 predates Node 22's ABI) and cannot be compiled (no toolchain). Verified: `npm install better-sqlite3@^9` on this Node 22 **fails** with a node-gyp/Python error. As committed, L0a **fails its own acceptance #2** ("npm install succeeds; better-sqlite3 installs & loads"). The report's "verified on Node 18" is not reproducible here — Node 18 isn't installed.

On the same Node 22 sandbox: **better-sqlite3 ^13 (13.0.3) installs via prebuilt in ~350ms, loads, and passes CREATE/INSERT/SELECT**. Its `engines.node` is `>=22`, matching the sandbox. With `^13` the **entire L0a gate is green**: install/build/lint/`format:check`/test (4 tests incl. the load test)/`dev` + `GET /api/health` 200 `{ok:true}` + unknown route 404 — all verified on a throwaway copy.

**Action (L0a retry 2):** `server/package.json` better-sqlite3 `^9`→`^13`; root `package.json` `engines.node` `>=18`→`>=22` (honest: ^13 requires it); regenerate `package-lock.json`; keep `server/src/better-sqlite3.load.test.ts`; re-run the full gate. The scaffold code (Express app, `/api/health`, 404/500, factory, configs, placeholder+load tests) is otherwise correct and is **kept**. The earlier narrative "^13 segfaults on Node 18" was never reproducible here (no Node 18); on the sandbox's Node 22, ^13 is verified-good. **L0a retry 1 is REJECTED; retry 2 is reassigned.** This is an engineering pin within the committed stack — not a user decision.

## Dependency order (merge queue lands one branch at a time)
L0a(retry 2) ──► L0b
      │                  │
      ▼                  ▼
    L1 (db+repos)      F1 waits on L2
      │
      ▼
  L2 (rest api) ──► F1 (frontend core: types/client/theme/layout/router)
        │                │
        └───────────────┼──────────────┐
                        ▼              ▼
                    L3 (boards)   L4 (board view+DnD)   L5 (CI)   [concurrent-safe, disjoint files]
                        │              │
                        └──────────────┘
                           ▼
                         L6 (integration: README + e2e)
Concurrency: {L1, L0b} after L0a(retry 2); {L3, L4, L5} after F1; L6 last.

## Files owned per leaf (no overlap within a concurrent group)
- **L0a(retry 2)**: root `package.json` (workspaces + extensible scripts; `engines.node>=22`), `/.gitignore`, root `tsconfig.json`+`.eslintrc.json`+`.prettierrc`+`.prettierignore`, `server/package.json` (better-sqlite3 ^13), `server/tsconfig.json`, `server/.gitignore`, `server/src/index.ts` (`/api/health`, 404, 500; `createApp` factory), `server/src/placeholder.test.ts`, `server/src/better-sqlite3.load.test.ts`; regenerate `package-lock.json`. No client files; no boards/lists/cards routes.
- **L0b**: all `client/` + `CONTRIBUTING.md` + adds `client` workspace to root scripts.
- **L1**: `server/src/db/*`, `server/src/models/repos.ts`, extends `server/src/index.ts` (DB init).
- **L2**: `server/src/routes/*`, `server/docs/api.md`, `server/src/routes/*.test.ts`; extends `server/src/index.ts` (router@`/api`+cors+validation handler).
- **F1**: `client/src/types.ts`, `api/client.ts`, `styles/*`, `theme.ts`, `components/Layout.tsx`, `App.tsx`, `pages/*` stubs, `vitest.setup.ts`.
- **L3**: replaces `pages/BoardsPage.tsx` + `BoardCard`, `NewBoardDialog`, test.
- **L4**: replaces `pages/BoardView.tsx` + `CardForm`, `CardDetail`, `ListColumn`, test. (Core Kanban+DnD.)
- **L5**: `.github/workflows/ci.yml` only.
- **L6**: `README.md`, `scripts/e2e.mjs`, root `package.json` `e2e` script.

## Note on current tree state
L4 was missing from the task tree (described here and now created). L6 is currently parented under L0b in the tree even though its description (and this note) states it depends on L3/L4/L5 — a cosmetic parentage mismatch; L6 is not ready to assign (waits on L3/L4/L5 per its description) and will be gated correctly.
