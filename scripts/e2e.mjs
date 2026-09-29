/*
 * End-to-end persistence test for the OpenToDo server.
 *
 * What this script does (per the L6 spec):
 *   1. Boots the server on a TEMP database file (isolated, per-run).
 *   2. Runs the canonical board/lifecycle sequence:
 *        create board -> create 2 lists -> create 3 cards
 *        -> move a card to the other list -> reorder (within-list)
 *   3. "Reloads" by issuing fresh GET requests to the server and asserts the
 *      persisted order matches what the mutations produced.
 *   4. Exits non-zero on any failure.
 *
 * Implementation notes:
 *   - The server is booted in-process via the SAME `app` (Express) export the
 *     repo's own unit tests use; it listens on an OS-assigned free port so it
 *     never collides with the dev server (4000) or Vite (5173).
 *   - The board state is backed by a real SQLite FILE in the OS temp dir
 *     (NOT an in-memory DB), so a fresh GET genuinely reads persisted, on-disk
 *     state written by the mutation endpoints. The DB file existing on disk
 *     after the run is asserted as evidence of durability.
 *   - All HTTP traffic goes through Node's native `fetch` over a real socket,
 *     so this exercises the full request/response stack (router, models,
 *     better-sqlite3) end-to-end.
 *
 * Run with:  npm run e2e
 */

import { app } from '../server/src/index.ts';
import { openDatabase, initDb, setDb, closeDb } from '../server/src/db/index.ts';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

async function api(base, path, { method = 'GET', body } = {}) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
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
// Setup: isolated temp DB file + booted HTTP server on a free port.
// ---------------------------------------------------------------------------
const workDir = mkdtempSync(join(tmpdir(), 'opentodo-e2e-'));
const dbPath = join(workDir, 'e2e.db');
const db = openDatabase(dbPath);
initDb(db);
setDb(db);

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
    check(
      listA.position === 1 && listB.position === 2,
      'list positions assigned (1, 2)'
    );
  }

  // Create 3 cards in list A ----------------------------------------------
  let cA, cB, cC;
  {
    const r1 = await api(BASE, '/cards', { method: 'POST', body: { listId: listA.id, title: 'Card A' } });
    const r2 = await api(BASE, '/cards', { method: 'POST', body: { listId: listA.id, title: 'Card B' } });
    const r3 = await api(BASE, '/cards', { method: 'POST', body: { listId: listA.id, title: 'Card C' } });
    check(r1.status === 201 && r2.status === 201 && r3.status === 201, 'POST /cards x3 -> 201');
    cA = r1.json; cB = r2.json; cC = r3.json;
    check(
      titles([cA, cB, cC]) instanceof Array && titles([cA, cB, cC]).join(',') === 'Card A,Card B,Card C',
      'cards created in order A, B, C'
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
    'reloaded list order = Backlog, In Progress'
  );
  check(
    positions(lists).join(',') === '1,2',
    'reloaded list positions dense (1, 2)'
  );

  check(
    titles(cardsA).join(',') === 'Card C,Card A',
    'reloaded listA card order = Card C, Card A (persisted reorder)'
  );
  check(
    positions(cardsA).join(',') === '1,2',
    'reloaded listA card positions dense (1, 2)'
  );
  check(
    titles(cardsB).join(',') === 'Card B',
    'reloaded listB card order = Card B (persisted cross-list move)'
  );
  check(
    positions(cardsB).join(',') === '1',
    'reloaded listB card position dense (1)'
  );

  // Persistence evidence: the on-disk DB file is non-empty -----------------
  check(existsSync(dbPath), 'temp DB file exists on disk');
  check(statSync(dbPath).size > 0, 'temp DB file is non-empty');
} catch (err) {
  failures++;
  console.error('[e2e] unexpected error:', err && err.message ? err.message : err);
} finally {
  // Teardown --------------------------------------------------------------
  server.close();
  try { closeDb(); } catch { /* already closed is fine */ }
  rmSync(workDir, { recursive: true, force: true });
  console.log(`[e2e] teardown complete`);
}

if (failures > 0) {
  console.error(`\n[e2e] FAILED with ${failures} assertion(s)`);
  process.exit(1);
}
console.log('\n[e2e] PASSED — all assertions green');
process.exit(0);
