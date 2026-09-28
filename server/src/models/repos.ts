import { getDb } from '../db';

// ---- Row types (mirror the schema columns) ----

export interface Board {
  id: number;
  title: string;
  position: number;
  created_at: string;
}

export interface List {
  id: number;
  board_id: number;
  title: string;
  position: number;
}

export interface Card {
  id: number;
  list_id: number;
  title: string;
  description: string;
  position: number;
}

// ---- Patch types (only fields the API permits updating) ----

export type BoardPatch = { title?: string };
export type ListPatch = { title?: string };
export type CardPatch = { title?: string; description?: string; list_id?: number };

// ---- Boards ---------------------------------------------------------------
// Boards are ordered by `position` (dense, 1-based). Positions are allocated on
// create (append = MAX(position)+1); there is no reorder endpoint, so updates
// only touch `title`.

function listBoards(): Board[] {
  return getDb()
    .prepare('SELECT * FROM boards ORDER BY position ASC, id ASC')
    .all() as Board[];
}

function getBoard(id: number): Board | undefined {
  return getDb().prepare('SELECT * FROM boards WHERE id = ?').get(id) as Board | undefined;
}

function createBoard(title: string): Board {
  const db = getDb();
  const max = (
    db.prepare('SELECT COALESCE(MAX(position), 0) AS max FROM boards').get() as {
      max: number;
    }
  ).max;
  return db
    .prepare('INSERT INTO boards (title, position) VALUES (?, ?) RETURNING *')
    .get(title, max + 1) as Board;
}

function updateBoard(id: number, patch: BoardPatch): Board | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) {
    fields.push('title = ?');
    values.push(patch.title);
  }
  if (fields.length === 0) return getBoard(id);
  db.prepare(`UPDATE boards SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  return getBoard(id);
}

function removeBoard(id: number): boolean {
  // FK cascade (ON DELETE CASCADE) removes the board's lists and cards.
  const info = getDb().prepare('DELETE FROM boards WHERE id = ?').run(id);
  return info.changes > 0;
}

export const boards = {
  list: listBoards,
  get: getBoard,
  create: createBoard,
  update: updateBoard,
  remove: removeBoard,
};

// ---- Lists ----------------------------------------------------------------
// Lists are ordered by `position` within a board. `reorder` re-normalizes a
// board's lists to a dense 1..n ordering inside a single transaction.

function listLists(boardId: number): List[] {
  return getDb()
    .prepare('SELECT * FROM lists WHERE board_id = ? ORDER BY position ASC, id ASC')
    .all(boardId) as List[];
}

function getList(id: number): List | undefined {
  return getDb().prepare('SELECT * FROM lists WHERE id = ?').get(id) as List | undefined;
}

function createList(boardId: number, title: string): List {
  const db = getDb();
  const max = (
    db
      .prepare('SELECT COALESCE(MAX(position), 0) AS max FROM lists WHERE board_id = ?')
      .get(boardId) as { max: number }
  ).max;
  return db
    .prepare('INSERT INTO lists (board_id, title, position) VALUES (?, ?, ?) RETURNING *')
    .get(boardId, title, max + 1) as List;
}

function updateList(id: number, patch: ListPatch): List | undefined {
  if (patch.title !== undefined) {
    getDb().prepare('UPDATE lists SET title = ? WHERE id = ?').run(patch.title, id);
  }
  return getList(id);
}

function removeList(id: number): boolean {
  // FK cascade (ON DELETE CASCADE) removes the list's cards automatically.
  const info = getDb().prepare('DELETE FROM lists WHERE id = ?').run(id);
  return info.changes > 0;
}

function reorderLists(boardId: number, idsInOrder: number[]): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE lists SET position = ? WHERE id = ? AND board_id = ?');
  db.transaction((ids: number[]) => {
    for (let i = 0; i < ids.length; i++) stmt.run(i + 1, ids[i], boardId);
  })(idsInOrder);
}

export const lists = {
  list: listLists,
  get: getList,
  create: createList,
  update: updateList,
  remove: removeList,
  reorder: reorderLists,
};

// ---- Cards ----------------------------------------------------------------
// Cards are ordered by `position` within a list. `position` is 0-based
// destination index when dropping (matches @hello-pangea/dnd's index); when
// omitted, the card is appended to the end of the target list. Both reorder
// and move re-normalize the affected list(s) to a dense 1..n ordering inside a
// single transaction.

function listCards(listId: number): Card[] {
  return getDb()
    .prepare('SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC')
    .all(listId) as Card[];
}

function getCard(id: number): Card | undefined {
  return getDb().prepare('SELECT * FROM cards WHERE id = ?').get(id) as Card | undefined;
}

function createCard(listId: number, title: string, description?: string): Card {
  const db = getDb();
  const max = (
    db
      .prepare('SELECT COALESCE(MAX(position), 0) AS max FROM cards WHERE list_id = ?')
      .get(listId) as { max: number }
  ).max;
  return db
    .prepare(
      'INSERT INTO cards (list_id, title, description, position) VALUES (?, ?, ?, ?) RETURNING *',
    )
    .get(listId, title, description ?? '', max + 1) as Card;
}

function updateCard(id: number, patch: CardPatch): Card | undefined {
  const card = getCard(id);
  if (!card) return undefined;

  if (patch.list_id !== undefined && patch.list_id !== card.list_id) {
    // Moving to another list: append to the target list (re-normalizes both
    // lists). If the target list does not exist, treat as not-found.
    const moved = cards.move(patch.list_id, id);
    if (!moved) return undefined;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) {
    fields.push('title = ?');
    values.push(patch.title);
  }
  if (patch.description !== undefined) {
    fields.push('description = ?');
    values.push(patch.description);
  }
  if (fields.length > 0) {
    getDb().prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  }
  return getCard(id);
}

function removeCard(id: number): boolean {
  const info = getDb().prepare('DELETE FROM cards WHERE id = ?').run(id);
  return info.changes > 0;
}

function reorderCards(listId: number, idsInOrder: number[]): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE cards SET position = ? WHERE id = ? AND list_id = ?');
  db.transaction((ids: number[]) => {
    for (let i = 0; i < ids.length; i++) stmt.run(i + 1, ids[i], listId);
  })(idsInOrder);
}

function moveCard(listId: number, cardId: number, position?: number): Card | undefined {
  const db = getDb();
  const cardStmt = db.prepare('SELECT * FROM cards WHERE id = ?');
  const listStmt = db.prepare('SELECT 1 FROM lists WHERE id = ?');
  const othersStmt = db.prepare(
    'SELECT * FROM cards WHERE list_id = ? AND id != ? ORDER BY position ASC, id ASC',
  );
  const setListStmt = db.prepare('UPDATE cards SET list_id = ? WHERE id = ?');
  const setPosStmt = db.prepare('UPDATE cards SET position = ? WHERE id = ?');
  const prevListStmt = db.prepare(
    'SELECT id FROM cards WHERE list_id = ? ORDER BY position ASC, id ASC',
  );

  const run = db.transaction(
    (targetListId: number, cid: number, pos: number | undefined) => {
      const card = cardStmt.get(cid) as Card | undefined;
      if (!card) return undefined;
      if (!listStmt.get(targetListId)) return undefined;

      const others = othersStmt.all(targetListId, cid) as Card[];
      const insertAt =
        pos === undefined ? others.length : Math.max(0, Math.min(pos, others.length));
      const newOrder: Card[] = others.slice();
      newOrder.splice(insertAt, 0, card);

      setListStmt.run(targetListId, cid);
      for (let i = 0; i < newOrder.length; i++) setPosStmt.run(i + 1, newOrder[i].id);

      // Re-normalize the card's previous list if it moved from a different one.
      if (card.list_id !== targetListId) {
        const prev = prevListStmt.all(card.list_id) as { id: number }[];
        for (let i = 0; i < prev.length; i++) setPosStmt.run(i + 1, prev[i].id);
      }
      // Re-fetch so the returned row reflects the just-written list_id/position.
      return cardStmt.get(cid) as Card;
    },
  );

  return run(listId, cardId, position);
}

export const cards = {
  list: listCards,
  get: getCard,
  create: createCard,
  update: updateCard,
  remove: removeCard,
  reorder: reorderCards,
  move: moveCard,
};
