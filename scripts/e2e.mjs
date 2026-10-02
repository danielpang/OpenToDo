/*
 * End-to-end test for the OpenToDo server: persistence + authenticated session.
 *
 * What this script does (per the L6 spec + auth-e2e leaf):
 *   1. Boots the server on an isolated temp database file (todos, better-sqlite3).
 *   2. Brings up a second, separate temp SQLite database (node:sqlite) for
 *      BetterAuth and runs `getMigrations` against it — mirroring production
 *      where auth and app data live in different files.
 *   3. Seeds an email/password test user (signUpEmail) and signs in over HTTP
 *      (POST /api/auth/sign-in/email, with an Origin header as BetterAuth's
 *      CSRF check expects) to obtain the signed `better-auth.session_token`
 *      cookie.
 *   4. Asserts unauthenticated CRUD is rejected with 401 { error: 'Unauthenticated' }
 *      and authenticated CRUD succeeds with 200.
 *   5. Runs the canonical board/lifecycle sequence:
 *        create board -> create 2 lists -> create 3 cards
 *        -> move a card to the other list -> reorder (within-list)
 *   6. "Reloads" by issuing fresh GET requests and asserts the persisted order
 *      matches what the mutations produced.
 *   7. Exits non-zero on any failure.
 *
 * Implementation notes:
 *   - The server is booted in-process via the SAME `app` (Express) export the
 *     repo's own unit tests use; it listens on an OS-assigned free port so it
 *     never collides with the dev server (4000) or Vite (5173).
 *   - `better-auth`'s lazy singleton is overridden via `setAuth(auth)` with the
 *     migrated temp-DB instance, so `requireAuth` validates against the same DB
 *     that minted the session cookie.
 *   - The board state is backed by a real SQLite FILE in the OS temp dir
 *     (NOT an in-memory DB), so a fresh GET genuinely reads persisted, on-disk
 *     state written by the mutation endpoints.
 *   - All HTTP traffic goes through Node's native `fetch` over a real socket,
 *     exercising the full request/response stack (router, models, requireAuth,
 *     better-auth session validation, better-sqlite3).
 *
 * Run with:  npm run e2e
 */

import { DatabaseSync } from 'node:sqlite';
import { getMigrations } from 'better-auth/db/migration';
import { app } from '../server/src/index.ts';
import { createAuth, setAuth } from '../server/src/auth.ts';
import { openDatabase, initDb, setDb, closeDb } from '../server/src/db/index.ts';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// BetterAuth needs a stable secret + base URL for cookie signing / CSRF.
// `createAuth` reads these from the environment, so set them before building
// the auth instance below. The Origin we send on sign-in matches BETTER_AUTH_URL.
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:4000';
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || 'dev-better-auth-secret-replace-in-production';

// Test credentials.
const E2E_EMAIL = 'e2e@test.com';
const E2E_PASSWORD = 'pass12345';
const E2E_NAME = 'E2E User';

// ---------------------------------------------------------------------------
// Minimal assert + HTTP helpers (no test framework needed).
// ---------------------------------------------------------------------------
let failures = 0;

function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error('  ✗ ' + msg);
  } else {
    console.log('  ✓ ' + msg);
  }
}

/**
 * Parse a `Set-Cookie` header list and return the `better-auth.session_token`
 * cookie pair suitable for use in a request `Cookie` header. Returns `null`
 * when no session cookie is present.
 */
function sessionCookieFromSetCookie(setCookie) {
  if (!setCookie) return null;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of arr) {
    const m = /^better-auth\.session_token=([^;]+)/.exec(c || '');
    if (m) return `better-auth.session_token=${m[1]}`;
  }
  return null;
}

// Set after a successful sign-in; `api()` attaches it to every request
// automatically so authenticated CRUD "just works".
let sessionIdCookie = null;

async function api(base, path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  // An explicit `cookie` arg wins; otherwise reuse the global session cookie.
  const useCookie = cookie !== undefined ? cookie : sessionIdCookie;
  if (useCookie) headers['cookie'] = useCookie;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(base + path, opts);
  let json;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }
  return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// Setup: isolated temp dirs + DB files for both the app (todos) and auth.
// ---------------------------------------------------------------------------
const workDir = mkdtempSync(join(tmpdir(), 'opentodo-e2e-'));

// App DB (todos) — real on-disk file (better-sqlite3), separate from auth DB.
const dbPath = join(workDir, 'e2e.db');
const db = openDatabase(dbPath);
initDb(db);
setDb(db);

// Auth DB (node:sqlite) — separate file, matching production (auth vs app).
const authDbPath = join(workDir, 'e2e-auth.db');
const authDb = new DatabaseSync(authDbPath);

// Build + migrate the auth instance, then install it as the singleton so the
// server's `requireAuth` / `toNodeHandler` validate against this same DB.
const auth = createAuth(authDb);
const { runMigrations } = await getMigrations({ ...auth.options, database: authDb });
await runMigrations();
setAuth(auth);

// Seed the test user (email/password). createAuth enables `emailAndPassword`,
// so the `user`/`account` tables (migrated above) accept the credential.
await auth.api.signUpEmail({ body: { email: E2E_EMAIL, password: E2E_PASSWORD, name: E2E_NAME } });
console.log('[e2e] seeded test user', E2E_EMAIL);

const server = app.listen(0);
const port = server.address().port;
const BASE = `http://localhost:${port}/api`;

console.log(`[e2e] server booted on http://localhost:${port} (temp db: ${dbPath})`);

function titles(rows) {
  return Array.isArray(rows) ? rows.map((r) => r.title) : [];
}
function positions(rows) {
  return Array.isArray(rows) ? rows.map((r) => r.position) : [];
}

try {
  // --- Sign in over HTTP to obtain the session cookie ----------------------
  // BetterAuth's CSRF guard requires a matching Origin on POST /sign-in, so we
  // echo the configured BETTER_AUTH_URL (same value `createAuth` uses as
  // baseURL). The response carries the signed session cookie.
  const signInRes = await fetch(`${BASE}/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Origin: process.env.BETTER_AUTH_URL },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD, callbackURL: '/' }),
  });
  check(signInRes.status === 200, 'POST /api/auth/sign-in/email -> 200');
  const setCookie = signInRes.headers.getSetCookie
    ? signInRes.headers.getSetCookie()
    : [signInRes.headers.get('set-cookie')].filter(Boolean);
  sessionIdCookie = sessionCookieFromSetCookie(setCookie);
  check(sessionIdCookie !== null, 'session cookie obtained from sign-in');

  // --- Authenticated gate: unauthenticated CRUD must be rejected ----------
  {
    const { status, json } = await api(BASE, '/boards', { cookie: null });
    // `cookie: null` forces api() to send NO cookie (ignores the singleton).
    check(status === 401, 'GET /boards (no cookie) -> 401');
    check(json && json.error === 'Unauthenticated', "401 body { error: 'Unauthenticated' }");
  }

  // --- Authenticated: the cookie now lets CRUD succeed ---------------------
  {
    const { status, json } = await api(BASE, '/boards');
    check(status === 200, 'GET /boards (cookie) -> 200');
    check(Array.isArray(json), 'authenticated /boards returns an array');
  }

  // Health check -----------------------------------------------------------
  {
    const { status, json } = await api(BASE, '/health');
    check(status === 200, `GET /health -> 200`);
    check(json && json.ok === true, `GET /health body { ok: true }`);
  }

  // Create board -----------------------------------------------------------
  let board;
  {
    const { status, json } = await api(BASE, '/boards', {
      method: 'POST',
      body: { title: 'E2E Board' },
    });
    check(status === 201, 'POST /boards -> 201');
    check(json && json.title === 'E2E Board', 'board title persisted');
    check(json && typeof json.id === 'number', 'board has numeric id');
    board = json;
  }

  // Create 2 lists ---------------------------------------------------------
  let listA, listB;
  {
    const a = await api(BASE, '/lists', {
      method: 'POST',
      body: { boardId: board.id, title: 'Backlog' },
    });
    const b = await api(BASE, '/lists', {
      method: 'POST',
      body: { boardId: board.id, title: 'In Progress' },
    });
    check(a.status === 201 && b.status === 201, 'POST /lists x2 -> 201');
    listA = a.json;
    listB = b.json;
    check(listA.title === 'Backlog' && listB.title === 'In Progress', 'list titles persisted');
    check(listA.position === 1 && listB.position === 2, 'list positions assigned (1, 2)');
  }

  // Create 3 cards in list A ----------------------------------------------
  let cA, cB, cC;
  {
    const r1 = await api(BASE, '/cards', {
      method: 'POST',
      body: { listId: listA.id, title: 'Card A' },
    });
    const r2 = await api(BASE, '/cards', {
      method: 'POST',
      body: { listId: listA.id, title: 'Card B' },
    });
    const r3 = await api(BASE, '/cards', {
      method: 'POST',
      body: { listId: listA.id, title: 'Card C' },
    });
    check(r1.status === 201 && r2.status === 201 && r3.status === 201, 'POST /cards x3 -> 201');
    cA = r1.json;
    cB = r2.json;
    cC = r3.json;
    check(
      titles([cA, cB, cC]) instanceof Array &&
        titles([cA, cB, cC]).join(',') === 'Card A,Card B,Card C',
      'cards created in order A, B, C',
    );
  }

  // Move a card to the other list -----------------------------------------
  {
    // Move Card B from list A to list B.
    const { status, json } = await api(BASE, '/cards/move', {
      method: 'POST',
      body: { fromListId: listA.id, toListId: listB.id, cardId: cB.id },
    });
    check(status === 200, 'POST /cards/move (across lists) -> 200');
    check(json && json.listId === listB.id, 'moved card now belongs to listB');
  }

  // Reorder within list A: bring Card C to the front (position 0) ---------
  {
    const { status } = await api(BASE, '/cards/move', {
      method: 'POST',
      body: { fromListId: listA.id, toListId: listA.id, cardId: cC.id, position: 0 },
    });
    check(status === 200, 'POST /cards/move (within list, position 0) -> 200');
  }

  // Reload: fresh GET requests that read persisted state from the DB -------
  // After the mutations we expect:
  //   listA = [Card C, Card A]   (Card B moved out; Card C reordered to front)
  //   listB = [Card B]
  //   list order on the board = [Backlog, In Progress]
  const { status: ls, json: lists } = await api(BASE, `/lists?boardId=${board.id}`);
  const { status: cas, json: cardsA } = await api(BASE, `/cards?listId=${listA.id}`);
  const { status: cbs, json: cardsB } = await api(BASE, `/cards?listId=${listB.id}`);

  check(ls === 200, 'GET /lists?boardId -> 200');
  check(cas === 200, 'GET /cards?listId (A) -> 200');
  check(cbs === 200, 'GET /cards?listId (B) -> 200');

  const listTitles = titles(lists);
  check(
    listTitles.join(',') === 'Backlog,In Progress',
    'reloaded list order = Backlog, In Progress',
  );
  check(positions(lists).join(',') === '1,2', 'reloaded list positions dense (1, 2)');

  check(
    titles(cardsA).join(',') === 'Card C,Card A',
    'reloaded listA card order = Card C, Card A (persisted reorder)',
  );
  check(positions(cardsA).join(',') === '1,2', 'reloaded listA card positions dense (1, 2)');
  check(
    titles(cardsB).join(',') === 'Card B',
    'reloaded listB card order = Card B (persisted cross-list move)',
  );
  check(positions(cardsB).join(',') === '1', 'reloaded listB card position dense (1)');

  // Persistence evidence: the on-disk DB file is non-empty -----------------
  check(existsSync(dbPath), 'temp DB file exists on disk');
  check(statSync(dbPath).size > 0, 'temp DB file is non-empty');
} catch (err) {
  failures++;
  console.error('[e2e] unexpected error:', err && err.message ? err.message : err);
} finally {
  // Teardown --------------------------------------------------------------
  server.close();
  try {
    closeDb();
  } catch {
    /* already closed is fine */
  }
  try {
    authDb.close();
  } catch {
    /* already closed is fine */
  }
  rmSync(workDir, { recursive: true, force: true });
  console.log(`[e2e] teardown complete`);
}

if (failures > 0) {
  console.error(`\n[e2e] FAILED with ${failures} assertion(s)`);
  process.exit(1);
}
console.log('\n[e2e] PASSED — all assertions green');
process.exit(0);
