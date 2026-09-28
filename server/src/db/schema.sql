-- Initial schema for the ToDo app (L1).
-- Idempotent: every table/index uses IF NOT EXISTS and the 'schema_version'
-- meta row is inserted with INSERT OR IGNORE, so re-running initDb() is a no-op.
-- Mirrors the SCHEMA_SQL constant embedded in db/index.ts (which is the copy
-- executed under every module system, including ESM-in-Vitest).

PRAGMA foreign_keys = ON;

-- Key/value metadata table; records the applied schema version.
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');

-- Boards: top-level grouping. `position` orders boards within the workspace.
CREATE TABLE IF NOT EXISTS boards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Lists belong to a board. Deleting a board cascades to its lists (and cards).
CREATE TABLE IF NOT EXISTS lists (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  title    TEXT    NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
);

-- Cards belong to a list. Deleting a list cascades to its cards.
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
