# Contributing to OpenToDo

OpenToDo is a Trello-like boards/lists/cards app: an Express + TypeScript +
`better-sqlite3` **server** and a React + Vite + Tailwind + React Router +
`@hello-pangea/dnd` **client**, managed as an [npm workspaces](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#workspaces)
monorepo from the repository root.

## Prerequisites

- **Node.js `>= 22`** — the server's `better-sqlite3` ships a prebuilt binary
  that targets the Node 22 ABI. Do **not** use Node 18.
- **npm 10** (ships with the supported Node builds).

> The sandbox used to develop this MVP has no system C compiler or Python, so
> every native module must come from an npm prebuilt. This is already satisfied
> by `better-sqlite3@^13`.

## Setup

From the repository root:

```bash
npm install   # installs BOTH the `server` and `client` workspaces
```

This produces a single root `node_modules/` (with workspace symlinks for
`server` and `client`) and regenerates `package-lock.json`. The server database
lives at `server/data/todo.db` and is git-ignored; it is created on first run.

### Installing in a Python/C-compiler-less sandbox

`better-sqlite3` is a native module. On a host **without** Python or a C
compiler (such as the Bento sandbox), a clean `npm install` / `npm ci` aborts
because npm attempts to compile its addon from source (`node-gyp rebuild`).
`better-sqlite3@^13` ships an N-API prebuilt that needs **no** compilation, so the
lifecycle build can be skipped and the one remaining script-only dependency
(esbuild) satisfied explicitly:

```bash
npm install --ignore-scripts                       # skip ALL install scripts (better-sqlite3 gyp + esbuild binary fetch)
node node_modules/esbuild/install.js               # fetch the esbuild native binary
node node_modules/vite/node_modules/esbuild/install.js   # fetch Vite's bundled esbuild binary
```

After this, `better-sqlite3` loads its bundled `prebuilds/*.node` and a plain
`npm install` on the populated tree is a no-op (exit 0). If `package-lock.json`
looks stale, run `npm install` (populated tree) to refresh it.

## Workspace layout

| Workspace | Path      | Tech                                                              |
| --------- | --------- | ----------------------------------------------------------------- |
| Server    | `server/` | Express, TypeScript, better-sqlite3, tsc, vitest                  |
| Client    | `client/` | React 18, Vite, Tailwind, React Router, @hello-pangea/dnd, vitest |

Run any script in a single workspace with `npm run <script> --workspace=<name>`.

## Development

Start **both** tiers with hot reload in a single command (the server also starts
with `tsx watch`):

```bash
npm run dev
```

- Server: `http://localhost:4000`
- Client (Vite dev server): `http://localhost:5173`

The client proxies `/api/*` to `http://localhost:4000` (see
`client/vite.config.ts`), so the UI can call the API without CORS concerns
during local development. In production the client is built into
`client/dist/` and served from the same origin as the API.

Quick smoke test while the dev servers are running:

```bash
curl http://localhost:4000/api/health   # -> 200 {"ok":true}
curl http://localhost:5173/api/health   # -> proxied, 200 {"ok":true}
```

## Build

Build **both** tiers for production in one command:

```bash
npm run build
```

- Server: `tsc` compiles to `server/dist/`.
- Client: `tsc --noEmit` type-checks (Vite's build does not typecheck on its
  own), then `vite build` emits to `client/dist/`.

Both must pass with zero TypeScript errors and zero lint errors.

## Type-check

```bash
npm run typecheck     # server (tsc build) + client (tsc --noEmit)
```

## Lint & format

```bash
npm run lint          # server (eslint, .ts) + client (eslint, .ts/.tsx)
npm run format        # prettier --write .
npm run format:check  # prettier --check .
```

## Tests

Run **both** tiers' test suites:

```bash
npm test              # server (vitest) + client (vitest + jsdom)
```

- Server tests: `server/src/*.test.ts` (API health + SQLite load).
- Client tests: `client/src/**/*.test.{ts,tsx}` (shell placeholder + theme
  tokens), run in a jsdom environment with `client/vitest.setup.ts`.

## Theme

The client theme is defined in `client/src/theme.ts` and contains:

- distinct **primary** (`#0ea5e6`, sky) and **accent** (`#f59e0b`, amber) colors,
- a "fun but not gaudy" **surface** palette with `light` and `dark` variants,
- **motion** tokens, including a `spring` easing that is actually used by the
  shell — the `Layout` header slides and fades in on mount using
  `motion.spring`.

Dark/light is driven by a `dark` class on `<html>` (applied from the OS colour
scheme in `client/src/main.tsx`) together with Tailwind's `dark:` variants and
CSS custom properties in `client/src/index.css`.

---

This is a planning-stage repository. See `PLAN.md` and `docs/bento/swarm/design.md`
for the overall roadmap and the leaf task that produced this scaffold.
