# Trello MVP — Swarm Design Note

## Stack & environment (frozen)
- Node v22.22.2 (arm64/linux), npm 10.9.7. Node only at `/opt/bento/node/bin` — every shell must `export PATH=/opt/bento/node/bin:$PATH`.
- `better-sqlite3` **must be `^13`** (v13.0.3 ships a Node-22/arm64 `linux-arm64.node` prebuilt). `^9` has no Node-22 prebuilt and can't compile (no python/gcc/g++/make). **Never `npm install` with scripts** here → always `npm install --ignore-scripts`; the v13 prebuilt loads at runtime via `node-gyp-build`. (Verified: `:memory:` create/insert/select round-trips.)
- npm workspaces monorepo (`client` + `server`) from root. Root scripts run both tiers.
- SQLite file path from env `DB_PATH` (server `db.ts`); tests pass a temp path / `:memory:`.
- `client` = Vite + React 18 + TS + vitest + `@hello-pangea/dnd`. `server` = Express + TS + better-sqlite3 + vitest + tsx.

## Core data model
`boards(id,title) → lists(id,boardId,title,position) → cards(id,listId,title,description,position)`. `position` is an integer; reorder = renumber positions; cross-list move = set new `listId` (decided in the model, not drag-pixel math).

## Leaf dependency order (top→bottom)
L0a(Scaffold+workspaces) → L0b(Design+plan) → L1(server model + CRUD for cards/lists/boards) → L2(L1 + boards routes + cascade on DELETE) → F1(baseline gates green) → L3(server boards routes + tests, ✗merged) → L4(client BoardView DnD) → L5(client gate green on baseline) → **L6(README + e2e persistence script)**.

## L4 — Frontend: Kanban BoardView w/ DnD (ACCEPTED, verified green)
Commit `2083467` on `swarm/todo-app-mvp-aa6a1701`, parent `6f0d452` (current queue tip) → clean 1-commit FF.

### Primary files (client)
- replaces `client/src/pages/BoardView.tsx`; adds `BoardView.test.tsx`, `components/ListColumn.tsx`, `components/CardForm.tsx`, `components/CardDetail.tsx`.
- `client/vitest.setup.ts` jsdom shims (ResizeObserver, rAF, matchMedia).

### Scope correction (same leaf — "same-lines rule")
L4 also owns what L2 omitted (a board that lists nothing is not a board): `server/src/routes/lists.ts` (GET `/api/lists?boardId=`) & `cards.ts` (GET `/api/cards?listId=`) with projected `{id,...}`/404/400; `client/src/api/client.ts` `lists.list()`/`cards.list()`; `server/docs/api.md` GET docs; `client/vitest.setup.ts` shims.

### DnD
`@hello-pangea/dnd` (not react-dnd — no `findDOMNode` warnings; uses ref callbacks). `DragDropContext` → `Droppable type="COLUMN"` (horizontal lists) → each `ListColumn` is a `Draggable` (no type attr → any column accepts any column, reorder lists) → inner `Droppable type="CARD"` (vertical cards). `onDragEnd` handles reorder-list / reorder-card / move-card-between-lists; each writes API + optimistic local update; 404/500 → rollback + `role="alert"` banner w/ Retry.

### CRUD (UI ↔ API)
Add list (`POST /api/lists`), add card (`POST /api/cards`), edit card (click → `CardDetail` modal → Edit → inline `CardForm`: title required, "Saving…" disabled) → `PUT /api/cards/:id`, Delete `DELETE /api/cards/:id`. Delete card removes instantly + persists. Positions contiguous (10-step gaps, renumber on save).

### Lifecycle
`load()` fetches board→lists→cards on mount and after mutations; skeleton while loading, error banner on failure → reload shows persisted truth.

### Acceptance gates (all GREEN, verified in `/tmp/l4-verify` via `npm install --ignore-scripts`)
1. `npm --workspace client test` → 5 files, **18 passed** (17 baseline +1 BoardView.test). ✓
2. `npm --workspace client run typecheck` (`tsc --noEmit`) exit 0. ✓
3. `npm --workspace client run lint` exit 0. ✓
4. `npm --workspace server test` → 6 files, **93 passed** (83 baseline +10 GET tests in lists.test.ts/cards.test.ts). ✓
5. `npx tsc --noEmit -p server/tsconfig.json` exit 0. ✓
Test deltas match baseline exactly; baseline preserved (no reformatting of repos.ts/repos.test.ts/better-sqlite3.d.ts). Better-sqlite3@13.0.3 prebuilt loads at runtime.

### ⚠️ Caveat (finished-means #5)
"Deleting a list cascades in the UI and via API." The **via-API** half is met: `DELETE /api/lists/:id` cascades to cards (L2, tested) and BoardView re-fetches on mount. The list-**delete UI button** is NOT present (ListColumn/BoardView only wire card-delete). This is flagged as a scope question to the user (see `ask_user`). L4 is still accepted: the core Trello Kanban experience is verified green and the API+reload halves of #5 are met.

## Known-good baseline (preserved)
Pre-L4: server 83 tests / 6 files, client 17 tests / 4 files. L4 → 93 / 18. `better-sqlite3@13.0.3`, `@hello-pangea/dnd@16.6.0`, `typescript@^5.5.4`.

## Decisions that are NOT the user's (planner call, recorded)
- better-sqlite3 `^13` + `--ignore-scripts` (forced by no-compiler sandbox; prebuilt works).
- `@hello-pangea/dnd` over `react-dnd` (no `findDOMNode`, maintained).
- Card detail as Trello-style modal (`CardDetail`, `role="dialog"`/`aria-modal`, Escape+clict-away) — matches real Trello; satisfies the leaf's "inline edit area" functionally via Edit→`CardForm`.
- List-delete UI button IS a user scope call (see ask) — **not** a planner decision.

## Current tree state
- L0a, L0b, L1, L2, F1, L3, L5: done.
- L4 (`aa6a1701`): **done/accepted** — branch in merge queue, FF-lands onto `swarm/todo-app-mvp`.
- L6 (`af16a044`): **assigned** — deps L3/L4/L5 done; independent of the list-delete question; file ownership docs/README.md + scripts/e2e.mjs + root `e2e` script.
- Prior rejected L4 attempts (`6f0059d5`, `52c1bf13`): cancelled/historical (zero-real-commit fabrication).
- `/tmp/l4-verify`: torn down after verification.
- `/workspace/OpenToDo`: on `swarm/todo-app-mvp` @ `6f0d452`, clean (not modified during verification).
- Open question to user: list-delete UI button (above).
