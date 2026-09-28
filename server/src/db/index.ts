import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';

/** A better-sqlite3 Database connection. */
export type Db = Database;

// Canonical initial schema. Kept in sync with ./schema.sql (the human-reviewed
// source of truth). Embedded as a string so migrations run under every module
// system (CommonJS, tsx, and ESM-in-Vitest) without a filesystem path read.
const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');

CREATE TABLE IF NOT EXISTS boards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lists (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  title    TEXT    NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id     INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lists_board_position ON lists (board_id, position);
CREATE INDEX IF NOT EXISTS idx_cards_list_position  ON cards (list_id, position);
`;

/**
 * Default on-disk database path (`<repo>/server/data/todo.db`).
 *
 * Resolved from this module's `__dirname` so it is correct regardless of the
 * process working directory. `__dirname` exists under tsx and tsc-compiled
 * CommonJS — the only contexts that reach here, since every test opens the
 * database with the literal string `':memory:'`. The `typeof` guard keeps
 * module load safe if `__dirname` is ever absent.
 */
export const DB_PATH = defaultDbPath();

function defaultDbPath(): string {
  const dir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  return join(dir, '..', '..', 'data', 'todo.db');
}

/**
 * Open a SQLite database handle. Pass `':memory:'` for an ephemeral database
 * (used by tests); any other path creates the parent directory on demand.
 */
export function openDatabase(path: string = DB_PATH): Db {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  // Enforce foreign keys (and ON DELETE CASCADE) on every connection,
  // including the in-memory test databases.
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Run the initial schema. Idempotent: every statement uses IF NOT EXISTS and
 * the schema_version row uses INSERT OR IGNORE, so calling this repeatedly is
 * a no-op after the first run.
 */
export function initDb(db: Db): void {
  db.exec(SCHEMA_SQL);
}

// --- Server-wide singleton -------------------------------------------------
// Used by the server startup path and (later) by route handlers. Tests replace
// it with an in-memory handle via setDb().

let _db: Db | undefined;

/** Return the shared database, creating and migrating it on first use. */
export function getDb(): Db {
  if (!_db) {
    _db = openDatabase();
    initDb(_db);
  }
  return _db;
}

/** Replace the shared database handle (used by tests to swap in `:memory:`). */
export function setDb(db: Db): Db {
  if (_db && _db !== db) {
    try {
      _db.close();
    } catch {
      /* already closed — ignore */
    }
  }
  _db = db;
  return db;
}

/** Close and clear the shared database handle. */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = undefined;
  }
}
