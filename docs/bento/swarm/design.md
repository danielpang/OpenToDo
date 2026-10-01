# Auth Swarm Design Note (verified)

Goal: layer BetterAuth SSO (Google + X.com) onto the landed Trello MVP without touching the
data model. The MVP DB layer stays on `better-sqlite3`; auth uses the **built-in `node:sqlite`**
(`DatabaseSync`) adapter that BetterAuth ships out of the box — no extra adapter dep.

## Stack & versions (verified)
- `better-auth@1.7.7` (declared in `server/package.json`). Exposes `./node`, `./test`,
  `./db/migration` subpath exports; runtime resolution uses the package `exports` map, so no
  runtime alias is needed for those (only TS type resolution).
- Node 22.23.3 (`/opt/node22/bin/node`). `/usr/bin/node` v18 is avoided — it SEGs
  `better-sqlite3`. npm runs via `/usr/bin/npm` with `PATH=/opt/node22/bin:$PATH`.
- `node:sqlite` is a real Node 22 built-in (`module.isBuiltin('node:sqlite')===true`,
  `require('node:sqlite').DatabaseSync` works) but is **NOT** in `module.builtinModules` —
  verified. This breaks Vite 5.4's built-in detection, so server tests use a CJS shim.

## Server (leaf 8dee2af5 — ACCEPTED, green)
- `server/src/auth.ts`: `createAuth(database?)` factory → `betterAuth(options)` backed by
  `DatabaseSync` (in-memory `:memory:` by default, or `BETTER_AUTH_DB_PATH`). Lazy
  `getAuth()`/`setAuth(null)` singleton. Providers wired **only when both id+secret env vars
  exist** so the factory boots with zero providers in tests. `emailAndPassword.enabled`,
  `rateLimit.enabled:false` (avoids needing the rate-limit table in an unmigrated DB).
- `server/src/middleware/requireAuth.ts`: `async (req,res,next)` → `getAuth().api.getSession`
  via `fromNodeHeaders(req.headers)`; **401 `{error:'Unauthenticated'}`** without a session,
  else attaches `res.locals.user`/`res.locals.session` and `next()`.
- `server/src/index.ts`: mount `GET /api/auth/ok → {ok:true,auth:true}` then
  `app.use('/api/auth', (req,res,next)=>toNodeHandler(getAuth())(req,res).catch(next))`
  **before** `express.json()` (raw bodies). Construction is lazy per-request, so importing the
  app is DB-free.
- `server/src/shims/node-sqlite-shim.cjs` + `server/vitest.config.ts`: alias `node:sqlite`
  and `sqlite` → the shim (CJS `require('node:sqlite')`); Vite's CJS loader leaves `require`
  intact, Node resolves the real built-in. `server/tsconfig.json` adds `paths` for
  `better-auth/node` / `better-auth/test` / `better-auth/db/migration` → dist `.d.mts`
  (node10 moduleResolution).
- Tests: `server/src/auth.test.ts` — 5 tests (factory boots, boots with no provider env,
  `/api/auth/ok`→200 on the real app, `requireAuth` 401 without session / 200 with a
  `getTestInstance`+`setAuth` testUser cookie). Full suite: 98/98 pass, tsc clean, eslint clean.

## Env vars (auth-docs leaf owns `.env.example`)
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`,
`BETTER_AUTH_URL` (default `http://localhost:4000`), `BETTER_AUTH_SECRET` (32+ chars; a
dev default is inline but MUST be replaced in prod), `BETTER_AUTH_DB_PATH` (optional;
default `:memory:`).

## X.com ↔ Twitter mapping (decided; not an open question)
BetterAuth 1.7.7 names the Twitter/X provider **`twitter`** (it hits X's OAuth at the Twitter
developer portal). There is no separate `x` subpath in this version, so "X.com SSO" is wired
through `socialProviders.twitter`. The provider key exposed to the client is therefore
`'twitter'`. `signIn.social('google')` and `signIn.social('twitter')` from the client.

## Deferred (intentional, per bootstrap gate)
`getAuth()` does **not** run migrations (`getMigrations`/`runMigrations` from
`better-auth/db/migration` against a non-:memory DB is a future leaf). Today the real
`/api/auth/*` routes exist but the auth tables aren't created until migrations land —
expected "Missing tables user/session/account/verification" warnings in tests. The
`/api/auth/ok` health route and the `requireAuth` guard are fully functional and tested
via the migrated `getTestInstance`.

## Downstream contract for remaining leaves
- auth-client (`ff31f67c`): client uses `createAuthClient` from `better-auth/react`, calls
  `signIn.social({ provider: 'google' | 'twitter' })`, attaches the session cookie with
  `credentials:'include'` (server sets `sameSite`/`secure` per BetterAuth defaults); guards
  `/boards*` via a `RequireAuth` component and a `/sign-in` route.
- auth-gate-todo-api (`26372288`): mount `requireAuth` before the boards/lists/cards routers
  in `server/src/routes/index.ts`; existing tests mint a `getTestInstance` cookie and assert
  unauthenticated → 401, authenticated CRUD still 200.
- auth-e2e (`39284f4f`) depends on 26372288; auth-docs (`2f5db206`) depends on 26372288.
