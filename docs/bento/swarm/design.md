# Swarm Design Note — ToDo App MVP

## Goal
Build a Trello-like clone in `/workspace/OpenToDo`: Boards → Lists → Cards, drag-and-drop
reorder/move, persistent storage, no auth (single shared workspace, reversible). Fun, creative,
beautiful, practical UI. Full leaf decomposition + per-leaf "finished means" live in `PLAN.md`.

## Stack
- **Server**: Node 18.19.1 + npm 9.2.0 (sandbox-fixed), Express + TypeScript + **better-sqlite3 v9**
  (on-disk persistence at `server/data/todo.db`; `:memory:` in tests). REST at `/api/...`.
  Tests: Vitest + supertest, co-located.
- **Client**: React 18 + TypeScript + Vite + Tailwind CSS + React Router v6 + `@hello-pangea/dnd`.
  Tests: Vitest + Testing Library + jsdom.
- Root `package.json` = npm workspaces (`client` + `server`); root scripts `dev/build/lint/test`
  run both tiers (+ `e2e` added by L6). Vite proxies `/api` → server in dev (no CORS locally).

## ⚠️ Planner correction — L0a retry (Node-18-compatible better-sqlite3)
The original single **L0** (weight-30, two-tier scaffold) **failed with no output**. It was split
into **L0a (server)** + **L0b (client)**. L0a was then attempted: the agent committed a server
scaffold (commit `37ab94b`, branch `swarm/todo-app-mvp-8217778b`) that *passed its own*
build/lint/format/test/dev+health checks, but (a) **filed no completion report**, and (b) pinned
`better-sqlite3@^13.0.0`, which **requires Node >=22 and SEGFAULTS (exit 139) on the sandbox's
Node v18.19.1**. L0a never imported better-sqlite3, so its own checks stayed green — but **L1
(which requires it) would crash at startup**. The dead L0a branch was never merged.

**Fix applied in the retry leaf "L0a (retry)"**: pin `better-sqlite3` to `^9` (9.6.0 verified to
both install AND `require()`-load on Node v18.19.1/arm64), and add a **load-regression test**
(`server/src/better-sqlite3.load.test.ts`) that runs a real `CREATE/INSERT/SELECT` in the test
runner — moving the "loads on arm64" check from "verified separately" (which L0a skipped) into
the test suite so it can never be skipped again. The planner independently verified end-to-end
that the corrected scaffold is green (build/lint/format/test/dev+health + load test) before
re-assigning. **L0a (retry) is assigned FIRST.** L0b stays blocked on it; L1 stays blocked on it.

Stack decision rationale: `better-sqlite3` stays as the committed persistence layer (per the
original open brief); only the major version is corrected to match the sandbox Node. No fallback
to `sqlite3`/`JSON` is needed — v9 works. No user decision required (engineering version pin
within the committed stack).

## Dependency order (merge queue lands one branch at a time)
```
L0a(retry) ──► L0b
      │                  │
      ▼                  ▼
    L1 (db+repos)      F1 waits on L2
      │
      ▼
  L2 (rest api) ──► F1 (frontend core: types/client/theme/layout/router)
                        │
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
       L3 (boards)   L4 (board view+DnD)   L5 (CI)   [concurrent-safe, disjoint files]
         │             │              │
         └─────────────┴──────────────┘
                    ▼
                  L6 (integration: README + e2e)
```
Concurrency (disjoint file sets): `{L1, L0b}` after L0a(retry); `{L3, L4, L5}` after F1;
`L6` alone at the end. Sequential chains (shared bootstrap files): L0a(retry)→L0b→F1,
L1→L2→F1.

## Files owned per leaf (no overlap within a concurrent group)
- **L0a(retry)**: root `package.json`/`tsconfig.json`/`.eslintrc.json`/`.prettierrc`+`.prettierignore`/`.gitignore` + server `package.json`/`tsconfig.json`/`src/index.ts` (+`/api/health`, 404/500) + `src/placeholder.test.ts` + NEW `src/better-sqlite3.load.test.ts`. (May reuse commit `37ab94b` via rebase/cherry-pick, but MUST fix the version + add the load test.) No client files.
- **L0b**: all `client/` + `CONTRIBUTING.md` + extends root scripts (adds `client` workspace).
- **L1**: `server/src/db/*`, `server/src/models/repos.ts` (+ extends `server/src/index.ts` for DB init).
- **L2**: `server/src/routes/*`, `server/docs/api.md` (+ extends `server/src/index.ts` for router+cors+validation handler).
- **F1**: `client/src/types.ts`, `api/client.ts`, `styles/*`, `theme.ts`, `components/Layout.tsx`, `App.tsx`, `pages/*.tsx` stubs, `vitest.setup.ts`.
- **L3**: replaces `pages/BoardsPage.tsx` + `BoardCard`, `NewBoardDialog`, test.
- **L4**: replaces `pages/BoardView.tsx` + `CardForm`, `CardDetail`, `ListColumn`, test.
- **L5**: `.github/workflows/ci.yml` only.
- **L6**: `README.md`, `scripts/e2e.mjs`, root `package.json` `e2e` script.

## Environment
Node v18.19.1 + npm 9.2.0 present; `registry.npmjs.org` reachable; **better-sqlite3 v9.6.0**
native prebuilts install AND load on arm64 (verified by the planner — ^13 does NOT; that is the
L0a defect). Repo had no eslint/prettier — L0a(retry) brings them in.
