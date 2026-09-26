# Swarm Plan — ToDo App MVP (Trello-like clone)

Goal (as written): *"Build a trello like clone in this empty repo, be creative. Build a fun
creative UI that is beautiful to look at and practical."*

Repository: `/workspace/OpenToDo` (currently empty — one init commit). Active branch:
`swarm/todo-app-mvp`. Every leaf below lands as its own branch off `swarm/todo-app-mvp` and
is merged by the merge queue, **one branch at a time**, in dependency order. The planner
commits only this plan file to `swarm/todo-app-mvp`; feature leaves are authored by workers.

---

## 1. Architecture & explicit decisions

This is an **open brief**, so the planner makes the engineering decisions that are standard for
this goal and states them here (so no agent has to guess):

- **Product model**: A Trello-like workspace with multiple **Boards → Lists → Cards**,
  drag-and-drop reorder, and **persistent** storage. **No authentication in the MVP** (single
  shared workspace). This is a deliberate, reversible decision — if multi-user is required,
  that is a future leaf; it does not block the MVP.
- **Stack**: a modern **web app** — this is what delivers a "fun, creative, beautiful" UI with
  real drag-and-drop and is the standard way to build a Trello clone.
  - `client/` — React 18 + TypeScript + Vite + Tailwind CSS + React Router v6 +
    `@hello-pangea/dnd` (the DnD library), tested with Vitest + Testing Library.
  - `server/` — Node + TypeScript + Express + **better-sqlite3** (real on-disk persistence,
    arm64 prebuilt binaries; fall back to `sqlite3` or a JSON-file store only if native
    install fails). Tested with Vitest + supertest.
  - Root `package.json` uses **npm workspaces** (`client` + `server`) so one `npm install`
    sets up everything; root scripts (`dev`, `build`, `lint`, `test`) run both tiers.
- **API contract**: REST over `/api/...`. The server documents the contract
  (`server/docs/api.md`); the client mirrors the DTOs in `client/src/types.ts`. They are
  **separate files** (no shared edits) and agree by convention.
- **Dev UX**: `npm run dev` runs the server (`tsx` watch) and the Vite dev server together;
  Vite proxies `/api` to the server so the browser never sees CORS during local dev.
- **Tests live with features**: each leaf that adds behavior owns a co-located test; the
  "finished" bar for each leaf includes green tests in its own scope. Cross-tier persistence
  is covered by the final integration leaf.

Environment note: this sandbox has no Node installed, but `apt-get` and
`registry.npmjs.org` are reachable, so Node is installable by executing agents. The scaffold
leaf (L0) is responsible for verifying the toolchain builds before anything else.

> If, at execution time, a Node toolchain genuinely cannot be provisioned, the planner's
> fallback would be a **zero-build static app** (vanilla HTML/CSS/ESM JS, `localStorage` or a
> small Deno/Bun single-file server). That is strictly a fallback — the plan below targets the
> web-stack MVP above, which best serves "beautiful & practical."

---

## 2. Dependency graph

Each leaf branches off the **current** `swarm/todo-app-mvp` (i.e. on top of already-merged
leaves, since the merge queue lands one at a time). A → B means "B depends on A having
landed" (A's files/B's branch is based on A).

```
T0 (scaffold) ─────► T1 (db+repos) ──► T2 (rest api+tests)
                                         │
                            F1 (frontend core: types/client/theme/layout)
                                         │
                     ┌───────────────────┼───────────────────┐
                     │                   │                   │
                  F3 (boards list)    F4 (board view+ DnD)  CI (.github workflow)
                     │                   │
              ┌──────┴───────────────────┴──────┐
              ▼                                  ▼
          E1 (integration + README + e2e)  [plan complete]
```

- `T0` is the **foundation** — it must land first (every leaf depends on the folder layout
  and scripts it defines).
- `T1` → `T2`: routes import the repositories T1 defines.
- `F1` depends on `T0` (client scaffold) and on `T2` landing (so the client is built to the
  **real** contract, not guesses). `F1` owns the router + page stubs, so `F3`/`F4` only
  replace stub bodies (disjoint page files → they may be worked in either order, and
  concurrently assigned since they do not touch each other's lines).
- `CI` depends on `T0`+`T2`+`F1` (it runs `lint/build/test` for both tiers); it only touches
  `.github/` so it never conflicts with feature leaves.
- `E1` depends on everything (it documents and persistence-tests the whole stack); it owns
  README + a small e2e script + dev runnotes.

Leaves that touch **disjoint file sets** can be assigned together (they will still land one
branch at a time). Leaves that would edit the same files are intentionally **not** assigned
concurrently:

| Concurrent-safe group (disjoint files) | Not concurrent (shared files) |
|---|---|
| F3 + F4 + CI (after F1) | T1→T2→F1 (sequential chain, each edits shared bootstrap) |
| E1 alone at the end | F3/F4 depend on F1 stubs existing |

---

## 3. The leaves

Naming convention for branches: `leaf/<slug>`. Assignment is recorded by the planner in the
swarm log; each leaf's "Finished means:" is the acceptance bar the assigned agent must meet.

---

### L0 — `leaf/scaffold`  (Foundation, assign FIRST)
**Files owned**: root `/package.json`, `/.gitignore`, root `tsconfig`/eslint/prettier configs,
`/server/package.json`, `/server/tsconfig.json`, `/server/.gitignore`,
`/server/src/index.ts` (Express app + `/health`), `/client/package.json`, `/client/tsconfig.json`,
`/client/vite.config.ts` (with `/api` proxy), `/client/index.html`, `/client/tailwind.config.js`,
`/client/postcss.config.js`, `/client/src/main.tsx`, `/client/src/App.tsx`, `/client/src/index.css`.

**Finished means:**
1. `Node ≥18` is available (installed via apt/corepack if absent) — verified by the agent.
2. `npm install` at root succeeds (installs both workspaces).
3. `npm run build` compiles **server** (`tsc` → `server/dist`) and **client** (`vite build` →
   `client/dist`) with **zero TS errors** and zero lint errors.
4. `npm run dev` starts **both** the server (watching) and the Vite dev server; hitting
   `http://localhost:4000/health` returns `200 OK { ok: true }`.
5. `npm test` at root runs workspace tests (server has a placeholder test so it's green).
6. A short `CONTRIBUTING.md` snippet documents the scripts. No feature behavior is merged here.

---

### L1 — `leaf/backend-db`  (depends on L0)
**Files owned**: `/server/src/db/index.ts` (sqlite connection + migration runner),
`/server/src/db/schema.sql`, `/server/src/models/repos.ts` (the repository layer), and it
extends `/server/src/index.ts` to initialize the DB at startup. **No routes yet.**

Data model (positions for ordering):
- `boards(id, title, position, created_at)`
- `lists(id, board_id, title, position)`
- `cards(id, list_id, title, description, position)`

Repository API (complete — L2 uses this exactly, so L2 should not need to edit L1):
`boards` { list, get, create, update, remove, reorder? (no board reorder for MVP) }
`lists` { list(boardId), create, update, remove, move(newBoardId?) } → MVP: `reorder(boardId, idsInOrder)`
`cards` { list(listId), create, update, remove, reorder(listId, idsInOrder), move(listId, cardId, position?) }

**Finished means:**
1. `schema.sql` creates the three tables above; migrations run automatically on startup and are
   idempotent (file-based DB at `server/data/todo.db`, `:memory:` in tests).
2. Every repository function is implemented and returns typed rows.
3. `npm --workspace server test` is green with unit tests (>=1 test per function, using an
   in-memory DB, with cleanup between tests).
4. TS compiles with no errors; lint clean.
5. Behavior is verifiable without HTTP (tests call repos directly).

---

### L2 — `leaf/backend-api`  (depends on L0, L1)
**Files owned**: `/server/src/routes/index.ts`, `/server/src/routes/boards.ts`,
`/server/src/routes/lists.ts`, `/server/src/routes/cards.ts`, `/server/docs/api.md`
(the contract), and `/server/src/routes/*.test.ts`. Extends `/server/src/index.ts` to mount
`router` at `/api` + add `cors` + a validation error handler.

**Endpoint contract (`server/docs/api.md`)**:
- `GET /api/boards`, `POST /api/boards` (`{title}`), `GET /api/boards/:id`,
  `PATCH /api/boards/:id` (`{title?}`), `DELETE /api/boards/:id`.
- `POST /api/lists` (`{boardId,title}`), `PATCH /api/lists/:id` (`{title?}`),
  `DELETE /api/lists/:id` (cascade-delete its cards), `POST /api/lists/reorder` 
  (`{boardId, ids[]}` ordered).
- `POST /api/cards` (`{listId,title,description?}`), `PATCH /api/cards/:id`
  (`{title?,description?,listId?}`), `DELETE /api/cards/:id`,
  `POST /api/cards/move` (`{fromListId,toListId,cardId,position?}`).
- Errors: `400` with `{error}` on bad/missing input, `404` on unknown id, `500` logged.

**Finished means:**
1. Every endpoint above works per the contract (status codes + shapes).
2. `npm --workspace server test` is green: supertest integration tests cover happy paths and
   error paths (bad body → 400, unknown id → 404, list delete cascades cards).
3. Reorder/Move actually persist new `position` values (a test reads them back).
4. `server/docs/api.md` accurately describes the contract the client (L4... I mean F1) relies on.
5. Lint + TS clean.

---

### F1 — `leaf/frontend-core`  (depends on L0, L2)
**Files owned**: `/client/src/types.ts` (DTOs mirroring `server/docs/api.md`),
`/client/src/api/client.ts` (typed `fetch` wrapper targeting `/api`),
`/client/src/styles/index.css` + `/client/src/theme.ts` (color palette, motion tokens,
dark/light), `/client/src/components/Layout.tsx` (header + `<Outlet/>`), `/client/src/App.tsx`
(router shell via React Router declaring `/boards` → `BoardsPage` and `/boards/:id` → `BoardView`
as **lazy routes**; the page modules are stub files), `/client/src/pages/BoardsPage.tsx`
(stub), `/client/src/pages/BoardView.tsx` (stub), plus Vitest setup
(`/client/vitest.setup.ts`, `/client/vite.config.ts` test block).

**Finished means:**
1. `npm --workspace client build` succeeds; `npm --workspace client test` is green (placeholder
   test). Zero TS errors.
2. `types.ts` matches `server/docs/api.md`; `api/client.ts` is typed around those DTOs.
3. The app shell renders a header and an `<Outlet/>`; both lazy routes resolve (stubs return a
   harmless placeholder). The dev server proxies `/api` to the backend.
4. A theme (palette + motion) exists and is documented for L3/L4 to reuse — **not generic**:
     distinct primary/accent colors, a "fun but not gaudy" surface, and at least one motion
     token (e.g., spring animation) used in the shell.
5. Lint + format clean.

---

### L3 — `leaf/frontend-boards`  (depends on F1)
**Files owned**: replaces `/client/src/pages/BoardsPage.tsx` (the F1 stub), adds
`/client/src/pages/BoardsPage.test.tsx`, and small co-located components
(`/client/src/components/BoardCard.tsx`, `/client/src/components/NewBoardDialog.tsx`).

**Finished means:**
1. `/boards` route shows the list of boards from the API (empty state when none).
2. "New board" opens a dialog, validates non-empty title, POSTs, and the board appears
   without a reload; deleting a board removes it from the list and persists.
3. Clicking a board navigates to `/boards/:id`.
4. Responsive (works on narrow screens); uses the F1 theme; no layout jank.
5. `npm --workspace client test` green for this page's component tests (render empty state,
   render a board, open/create).

---

### L4 — `leaf/frontend-boardview`  (depends on F1, L2)
**Files owned**: replaces `/client/src/pages/BoardView.tsx` (the F1 stub), adds
`/client/src/pages/BoardView.test.tsx`, and co-located components needed for the board
(`/client/src/components/CardForm.tsx`, `/client/src/components/CardDetail.tsx`,
`/client/src/components/ListColumn.tsx`). **This is the core Trello clone experience.**

**Finished means:**
1. `/boards/:id` renders that board's lists **horizontally** (a Kanban of vertical columns); each
   list shows its cards vertically.
2. **Create list** (inline input) and **create card** (inline input at the bottom of a list) work
   and persist.
3. Each card shows its title; clicking opens an inline/edit area to set **title + description**
   (save/cancel); delete card removes it.
4. **Drag-and-drop with `@hello-pangea/dnd`**: reorder cards within a list, move a card across
   lists, and reorder entire lists — each `onDragEnd` persists the new order to the API
   (L2 endpoints) and the UI reflects it instantly with a smooth spring motion.
5. Deleting a list cascades in the UI and via API; the page reloads the board's true state from
   the API on mount (so it survives a refresh).
6. Responsive: horizontal list rail scrolls on narrow viewports; no overflow bugs.
7. `npm --workspace client test` green (renders a board from fixtures, opens create card form).
8. No console errors / React warnings in the dev console during normal use.

---

### L5 — `leaf/ci`  (depends on L0, L2, F1)
**Files owned**: `/.github/workflows/ci.yml` (only file in this leaf).

**Finished means:**
1. Workflow runs on PRs to `swarm/todo-app-mvp` (and `main`): `npm install`, `npm run lint`,
   `npm run build`, `npm test`.
2. Fails the job on any error (lint/build/test).
3. YAML validates (`python3 -m json.tool`-style check not needed; just well-formed and
   `actionlint`-clean if available, else visually correct). No feature code touched.

---

### L6 — `leaf/integration`  (depends on everything above)
**Files owned**: `/README.md`, `/scripts/e2e.mjs` (a Node `fetch`-based persistence sequence),
and a `scripts/dev.sh` convenience (or documented root script) showing how to run the whole app.

**Finished means:**
1. `README.md` documents: architecture, how to install/dev/build, the API surface (link to
   `server/docs/api.md`), how tests are run per tier + at root, and the no-auth MVP scope.
2. `npm run e2e` (script in root `package.json` — **owned by this leaf**, no conflict with L0
   since L0 is already landed and this is an additive `"e2e"` key) boots the server on a temp
   DB, then runs: create board → create 2 lists → create 3 cards → move a card to the other
   list → reorder → reload (new server request) → assert persisted order matches. Exits non-zero
   on failure.
3. The dev experience is verified: `npm run dev` serves the UI at `localhost:5173` (or agreed
   port) with `/api` proxied, and the board persists after browser refresh.
4. All tests across both tiers pass together (`npm test` green).

---

## 4. Assignment & hand-back rules the workers should know

- **One leaf per branch, off `swarm/todo-app-mvp`** (the planner pre-bases each branch on the
  latest merged tip). Workers do **not** merge/push/PR — the queue lands it.
- **A worker must not edit files owned by another leaf.** If building a leaf reveals a needed
  change in another leaf's files, that is a *plan correction*: flag it to the planner rather
  than editing across leaves. The planner will split or reorder.
- **"Finished" is the bar.** A leaf that builds but has failing tests, or fails the finished
  criteria above, is rejected with a specific reason and given back. The planner judges the
  work, not the write-up.
- **Creativity is encouraged within a leaf's scope** (colors, micro-interactions, copy) — but
  the objective criteria (persistence, DnD correctness, responsive, tests green) are
  non-negotiable.

## 5. Leaf index (for quick assignment)

| # | Branch | Depends on | Assign when |
|---|--------|-----------|-------------|
| L0 | `leaf/scaffold` | — | now (next) |
| L1 | `leaf/backend-db` | L0 | L0 landed |
| L2 | `leaf/backend-api` | L0, L1 | L1 landed |
| F1 | `leaf/frontend-core` | L0, L2 | L2 landed |
| L3 | `leaf/frontend-boards` | F1 | F1 landed |
| L4 | `leaf/frontend-boardview` | F1, L2 | F1 landed (can run with L3) |
| L5 | `leaf/ci` | L0, L2, F1 | F1 landed |
| L6 | `leaf/integration` | L3, L4, L5 | L3, L4, L5 landed |
