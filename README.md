# OpenToDo

A Trello-like **Boards → Lists → Cards** app. The REST API is session-protected
with email/password authentication via [BetterAuth](https://better-auth.org); all
data lives in a local SQLite file, so the whole thing runs on `localhost` with no
database server and no external services (OAuth providers are optional).

> **MVP scope:** this is a local-first prototype. Authentication gates the API
> (you must sign in to read or mutate any board/list/card), but there is **no
> per-user data isolation** or multi-user sharing yet — every authenticated user
> sees the same boards. Every board/list/card lives in one SQLite database
> (`server/data/todo.db` by default), separate from BetterAuth's own session DB.
> The API is not designed for the public internet.

---

## Table of contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Install](#install)
- [Development](#development)
- [Build](#build)
- [API surface](#api-surface)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Configuration](#configuration)

---

## Architecture

OpenToDo is a JavaScript/TypeScript ** monorepo** (npm workspaces) split into two
tiered workspaces that communicate over HTTP:

```
                    ┌──────────────────┐
   browser ──────►  │  client (Vite)    │  ─┐  /api/*  ──►  ┌──────────────────┐
   React + DnD      │  UI on :5173      │   │               │  server (Express)│
                    └──────────────────┘   │               │  TS + better-sql │
                                           ─┘               │  SQLite on :4000 │
                                                            └──────────────────┘
```

| Tier       | Package                       | Tech                                                                | Role                                                         |
| ---------- | ----------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Server** | `opentodo-server` (`server/`) | Express + TypeScript + `better-sqlite3`                             | REST API (`/api/*`) and the single source of truth (SQLite). |
| **Client** | `opentodo-client` (`client/`) | React 18 + Vite + Tailwind CSS + React Router + `@hello-pangea/dnd` | Drag-and-drop Kanban board UI.                               |

**Data model.** A `board` owns `list`s; a `list` owns `card`s. `position` is a
**1-based, dense** integer within each parent, re-normalized on every move/reorder.
The server opens one SQLite database per process via `getDb()` / `setDb()` in
`server/src/db/index.ts` (default file: `server/data/todo.db`). Deleting a parent
cascades to its children via `ON DELETE CASCADE`.

**Request flow.** The dev client (Vite, `:5173`) proxies `/api/*` to the Express
server (`:4000`) so the browser never hits CORS during development. In a production
build the client is a static asset tree and the server can serve it.

---

## Prerequisites

- **Node.js `>= 22`** (developed against Node 22.x; the `engines` field enforces this).
- **npm 10+** (ships with Node 22).

No separate database server, Redis, or build tools (`make`/`g++`/`python`) are
required — dependencies ship prebuilt binaries.

> **Sandbox / minimal environments:** if the install fails with `gyp ERR! not ok`
> (no C/C++ toolchain), install with `--ignore-scripts` then fetch the native
> binaries manually. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the exact
> documented flow (`better-sqlite3`, `esbuild`, and `vite`'s `esbuild` binaries).

---

## Install

From the repository root:

```bash
git clone <repo-url>
cd OpenToDo
npm install       # on a normal machine
# …or, in a toolchain-less sandbox:
npm install --ignore-scripts
node node_modules/esbuild/install.js
node node_modules/vite/node_modules/esbuild/install.js
```

This installs and links both workspaces (`server/` and `client/`) together.

---

## Development

Run both tiers with hot-reload in one command:

```bash
npm run dev
```

This spawns, via `concurrently`:

- the **server** (`tsx watch src/index.ts`) on **http://localhost:4000**
- the **client** (`vite`) on **http://localhost:5173**, which proxies
  `/api/*` → `http://localhost:4000` (see `client/vite.config.ts`).

To run a tier in isolation:

```bash
npm run dev --workspace=server   # tsx watch; port 4000
npm run dev --workspace=client   # vite; port 5173
```

**Verify it's working:**

```bash
curl -s http://localhost:5173/            # → 200 (UI shell)
curl -s http://localhost:5173/api/health   # → {"ok":true} (proxied)
```

A board created through the UI (or the API) is written to
`server/data/todo.db`. Because `BoardView` fetches board/list/card state on
mount, a browser refresh re-reads the persisted on-disk data — state survives
refresh out of the box.

---

## Build

```bash
npm run build
```

Builds both workspaces:

- **Server:** `tsc` → `server/dist/` (compiled JS entry `server/dist/index.js`).
- **Client:** `tsc --noEmit` (type-check) then `vite build` → `client/dist/`
  (static asset tree).

Type-check just the client: `npm run typecheck --workspace=client`.

---

## Authentication

The server authenticates users with [BetterAuth](https://better-auth.org) using
email/password (optionally extended with Google and Twitter/X OAuth). Auth state
is a signed, `HttpOnly` cookie named `better-auth.session_token`, issued by the
built-in handlers mounted at `/api/auth`.

Session validation is enforced centrally: `requireAuth`
(`server/src/middleware/requireAuth.ts`) runs before the `boards`/`lists`/`cards`
routers in `server/src/routes/index.ts`, so every resource endpoint returns
`401 { "error": "Unauthenticated" }` when the cookie is absent or invalid.

**Local development flow:**

1. **Configure** `server/.env` from `server/.env.example` (at minimum
   `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_DB_PATH`). OAuth
   providers are enabled once their `*_CLIENT_ID` / `*_CLIENT_SECRET` pairs are
   set.
2. **Create a user** (email/password), then **sign in**:
   ```bash
   # sign up (run once per user):
   curl -X POST http://localhost:4000/api/auth/sign-up/email \
     -H 'content-type: application/json' -H 'Origin: http://localhost:4000' \
     -d '{"email":"dev@test.com","password":"pass12345","callbackURL":"/"}'
   # sign in (sets the better-auth.session_token cookie):
   curl -X POST http://localhost:4000/api/auth/sign-in/email \
     -H 'content-type: application/json' -H 'Origin: http://localhost:4000' \
     -d '{"email":"dev@test.com","password":"pass12345","callbackURL":"/"}'
   ```
3. **Use the cookie** on every subsequent `/api/*` request:
   ```bash
   curl -b "better-auth.session_token=<signed token>" http://localhost:4000/api/boards
   ```

> **CSRF on sign-in/sign-up:** BetterAuth requires the `Origin` header on
> `POST /api/auth/sign-in/email` and `POST /api/auth/sign-up/email` to match
> `BETTER_AUTH_URL`; omitting it returns `403 MISSING_OR_NULL_OR_ORIGIN`.

Auth is verified end-to-end by the e2e suite (`npm run e2e`), which boots a
migrated BetterAuth instance, seeds a user, signs in over HTTP, and asserts
`401` without a cookie and `200` with one. See
[`server/docs/api.md`](server/docs/api.md#authentication) for the full
`/api/auth/*` contract.

---

## API surface

The full, authoritative REST contract — every endpoint, request/response schema,
and status code — lives in **[`server/docs/api.md`](server/docs/api.md)**.

Quick reference (all under base URL `http://localhost:4000/api`, JSON in/out):

| Resource | Method   | Path                                                   | Returns                                 |
| -------- | -------- | ------------------------------------------------------ | --------------------------------------- |
| Boards   | `GET`    | `/boards`                                              | `Board[]`                               |
|          | `GET`    | `/boards/:id`                                          | `Board`                                 |
|          | `POST`   | `/boards` `{title}`                                    | `Board` (201)                           |
|          | `PATCH`  | `/boards/:id` `{title}`                                | `Board`                                 |
|          | `DELETE` | `/boards/:id`                                          | 204                                     |
| Lists    | `GET`    | `/lists?boardId=...`                                   | `List[]`                                |
|          | `POST`   | `/lists` `{boardId,title}`                             | `List` (201)                            |
|          | `POST`   | `/lists/reorder` `{boardId,ids[]}`                     | `List[]`                                |
|          | `PATCH`  | `/lists/:id` `{title}`                                 | `List`                                  |
|          | `DELETE` | `/lists/:id`                                           | 204                                     |
| Cards    | `GET`    | `/cards?listId=...`                                    | `Card[]`                                |
|          | `POST`   | `/cards` `{listId,title,description?}`                 | `Card` (201)                            |
|          | `POST`   | `/cards/move` `{fromListId,toListId,cardId,position?}` | `Card`                                  |
|          | `PATCH`  | `/cards/:id` `{title,description,listId}`              | `Card`                                  |
|          | `DELETE` | `/cards/:id`                                           | 204                                     |
| Auth     | `POST`   | `/auth/sign-in/email` 🔒                               | sets `better-auth.session_token` cookie |
|          | `POST`   | `/auth/sign-up/email` 🔒                               | sets `better-auth.session_token` cookie |
|          | `POST`   | `/auth/sign-out`                                       | clears the session cookie               |
|          | `GET`    | `/auth/get-session`                                    | current user/session                    |

Auth routes are mounted at `/api/auth` and handled by BetterAuth directly.
They require an `Origin` header matching `BETTER_AUTH_URL` on sign-in/sign-up
POSTs (CSRF). All other rows require a valid `better-auth.session_token` cookie;
see [Authentication](#authentication) and [`server/docs/api.md`](server/docs/api.md#authentication).

**Types:** request bodies use **camelCase**; the server projects SQLite rows
(`snake_case` columns such as `board_id`, `list_id`, `created_at`) to
camelCase responses. `position` is 1-based and dense. Errors return
`{ "error": "<message>" }` with status `400` (bad input), `404` (not found), or
`500` (unexpected). See `server/docs/api.md` for the complete contract.

---

## Testing

OpenToDo has two test tiers.

### 1. Unit / integration (`vitest`)

Runs the existing suites for both workspaces end-to-end (server uses
`supertest` against the real `app`, swapping a fresh `:memory:` DB via `setDb`;
client uses `jsdom` + React Testing Library):

```bash
npm test                                   # both tiers
npm run test --workspace=server            # server only
npm run test --workspace=client            # client only
```

### 2. End-to-end persistence (`scripts/e2e.mjs`)

A Node `fetch`-based e2e that **boots the server on a throwaway temp SQLite
file**, then runs the canonical board lifecycle and asserts persistence:

> create board → create 2 lists → create 3 cards → move a card to the other list
> → reorder (within-list) → reload via fresh `GET`s → assert the persisted order
> matches. Exits non-zero on any failure.

```bash
npm run e2e
```

The script boots the Express `app` on an OS-assigned free port (so it never
collides with the dev server on `:4000` or Vite on `:5173`), injects an isolated
temp DB via the same `setDb` idiom the repo's unit tests use, **brings up a
migrated BetterAuth instance on a separate temp SQLite DB, seeds a user, and
signs in over HTTP** to obtain the session cookie, then drives the whole board
lifecycle over real HTTP with native `fetch` and removes its temp DBs on exit.
It also asserts `401` on `GET /api/boards` without a cookie and `200` with one.

---

## Project layout

```
OpenToDo/
├── package.json              # root: workspaces + top-level scripts (dev, build, test, e2e, lint, typecheck, format)
├── CONTRIBUTING.md           # full setup (incl. toolchain-less install notes)
├── scripts/
│   └── e2e.mjs               # fetch-based persistence e2e (npm run e2e)
├── server/                   # opentodo-server
│   ├── docs/api.md           # authoritative REST API contract
│   ├── src/
│   │   ├── index.ts          # creates the Express app (exported as `app`); mounts /api/auth handler + route guard; listen() guarded by require.main === module
│   │   ├── auth.ts           # BetterAuth bootstrap (createAuth/getAuth/setAuth); email/password + optional Google/X & Twitter OAuth
│   │   ├── middleware/requireAuth.ts # 401 gate: validates the session cookie, attaches res.locals.user/session
│   │   ├── db/index.ts       # SQLite singleton: openDatabase / initDb / getDb / setDb / closeDb
│   │   ├── models/repos.ts   # data layer (position re-normalization, cascade-aware)
│   │   ├── routes/*.ts       # boards, lists, cards routers (mounted at /api)
│   │   └── routes/apiError.ts
│   └── data/                 # runtime DB (todo.db) — gitignored
└── client/                   # opentodo-client
    ├── vite.config.ts        # port 5173, /api proxy → :4000
    └── src/                  # React Kanban UI (BoardView with drag-and-drop)
```

---

## Configuration

| Variable                                      | Default                                        | Workspace | Description                                                                                                           |
| --------------------------------------------- | ---------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                        | `4000`                                         | server    | Express listen port.                                                                                                  |
| `BETTER_AUTH_URL`                             | `http://localhost:4000`                        | server    | Auth base URL — sets cookie scope and is the value the CSRF `Origin` check compares against on sign-in/sign-up POSTs. |
| `BETTER_AUTH_SECRET`                          | `dev-better-auth-secret-replace-in-production` | server    | BetterAuth session-cookie signing key (must be ≥ 32 chars; override in production).                                   |
| `BETTER_AUTH_DB_PATH`                         | `:memory:`                                     | server    | Auth session database (a `node:sqlite` file). Kept **separate** from the app's `todo.db` data store.                  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`   | _(empty)_                                      | server    | Google OAuth credentials. Leave empty to disable Google sign-in.                                                      |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | _(empty)_                                      | server    | Twitter/X OAuth credentials (BetterAuth `twitter` provider). Leave empty to disable X sign-in.                        |

The app's todo database is **not** env-configurable: it defaults to
`server/data/todo.db` (see `DB_PATH` in `server/src/db/index.ts`) and is created
on demand. Copy `server/.env.example` → `server/.env` and fill in the values
above before running with OAuth providers.

> **Note:** the API is now session-protected (email/password via BetterAuth; see
> [Authentication](#authentication)). Do not expose the server to untrusted
> networks.
