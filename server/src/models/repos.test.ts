import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, initDb, setDb, closeDb } from '../db';
import { boards, lists, cards } from './repos';

beforeEach(() => {
  const db = openDatabase(':memory:');
  initDb(db);
  setDb(db);
});

afterEach(() => {
  closeDb();
});

describe('boards', () => {
  it('create assigns an appended position and returns the row', () => {
    const b = boards.create('My Board');
    expect(b.title).toBe('My Board');
    expect(b.position).toBe(1);
  });

  it('list returns all boards ordered by position', () => {
    boards.create('A');
    boards.create('B');
    boards.create('C');
    expect(boards.list().map((x) => x.title)).toEqual(['A', 'B', 'C']);
  });

  it('get returns the board by id', () => {
    const b = boards.create('B1');
    expect(boards.get(b.id)).toMatchObject({ id: b.id, title: 'B1' });
  });

  it('get returns undefined for an unknown id', () => {
    expect(boards.get(9999)).toBeUndefined();
  });

  it('update changes the title and returns the row', () => {
    const b = boards.create('Old');
    const updated = boards.update(b.id, { title: 'New' });
    expect(updated?.title).toBe('New');
    expect(boards.get(b.id)?.title).toBe('New');
  });

  it('update returns undefined for an unknown id', () => {
    expect(boards.update(9999, { title: 'x' })).toBeUndefined();
  });

  it('remove deletes the board and its descendants (cascade)', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    const c = cards.create(l.id, 'C');
    expect(boards.remove(board.id)).toBe(true);
    expect(boards.get(board.id)).toBeUndefined();
    expect(lists.get(l.id)).toBeUndefined();
    expect(cards.get(c.id)).toBeUndefined();
  });

  it('remove returns false for an unknown id', () => {
    expect(boards.remove(9999)).toBe(false);
  });
});

describe('lists', () => {
  it('create appends a list to a board and assigns position', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'Todo');
    expect(l.board_id).toBe(board.id);
    expect(l.position).toBe(1);
  });

  it('create throws when the board does not exist (FK)', () => {
    expect(() => lists.create(9999, 'Nope')).toThrow();
  });

  it('list returns a board\'s lists ordered by position', () => {
    const board = boards.create('B');
    lists.create(board.id, 'A');
    lists.create(board.id, 'C');
    lists.create(board.id, 'B');
    expect(lists.list(board.id).map((x) => x.title)).toEqual(['A', 'C', 'B']);
  });

  it('get returns the list by id', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    expect(lists.get(l.id)).toMatchObject({ id: l.id, title: 'L' });
  });

  it('update changes the title and returns the row', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'Old');
    expect(lists.update(l.id, { title: 'New' })?.title).toBe('New');
    expect(lists.get(l.id)?.title).toBe('New');
  });

  it('remove cascades its cards', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    cards.create(l.id, 'Card 1');
    cards.create(l.id, 'Card 2');
    expect(lists.remove(l.id)).toBe(true);
    expect(cards.list(l.id)).toHaveLength(0);
    expect(lists.get(l.id)).toBeUndefined();
  });

  it('reorder persists the new position order', () => {
    const board = boards.create('B');
    const a = lists.create(board.id, 'A');
    const b = lists.create(board.id, 'B');
    const c = lists.create(board.id, 'C');
    lists.reorder(board.id, [c.id, a.id, b.id]);
    expect(lists.list(board.id).map((x) => x.title)).toEqual(['C', 'A', 'B']);
  });

  it('reorder leaves another board\'s lists untouched', () => {
    const board1 = boards.create('B1');
    const board2 = boards.create('B2');
    const la = lists.create(board1.id, 'A');
    lists.create(board2.id, 'B');
    lists.reorder(board1.id, [la.id]);
    expect(lists.list(board2.id).map((x) => x.title)).toEqual(['B']);
  });
});

describe('cards', () => {
  it('create appends a card and assigns position', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    const c = cards.create(l.id, 'Card');
    expect(c.list_id).toBe(l.id);
    expect(c.position).toBe(1);
    expect(c.description).toBe('');
  });

  it('create stores a description', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    const c = cards.create(l.id, 'T', 'a note');
    expect(c.description).toBe('a note');
  });

  it('list returns a list\'s cards ordered by position', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    cards.create(l.id, '1');
    cards.create(l.id, '2');
    cards.create(l.id, '3');
    expect(cards.list(l.id).map((x) => x.title)).toEqual(['1', '2', '3']);
  });

  it('get returns a card by id', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    const c = cards.create(l.id, 'C');
    expect(cards.get(c.id)).toMatchObject({ id: c.id, title: 'C' });
  });

  it('update changes title and description', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    const c = cards.create(l.id, 'Old');
    const u = cards.update(c.id, { title: 'New', description: 'desc' });
    expect(u?.title).toBe('New');
    expect(u?.description).toBe('desc');
  });

  it('update returns undefined for an unknown id', () => {
    expect(cards.update(9999, { title: 'x' })).toBeUndefined();
  });

  it('update moves a card to another list (append + re-normalize)', () => {
    const board = boards.create('B');
    const l1 = lists.create(board.id, 'L1');
    const l2 = lists.create(board.id, 'L2');
    const c = cards.create(l1.id, 'C');
    const moved = cards.update(c.id, { list_id: l2.id });
    expect(moved?.list_id).toBe(l2.id);
    expect(cards.list(l1.id)).toHaveLength(0);
    const inL2 = cards.list(l2.id);
    expect(inL2.map((x) => x.id)).toEqual([c.id]);
    expect(inL2[0].position).toBe(1);
  });

  it('update returns undefined when moving to a non-existent list', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    const c = cards.create(l.id, 'C');
    expect(cards.update(c.id, { list_id: 99999 })).toBeUndefined();
  });

  it('remove deletes a card', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    const c = cards.create(l.id, 'C');
    expect(cards.remove(c.id)).toBe(true);
    expect(cards.list(l.id)).toHaveLength(0);
  });

  it('remove returns false for an unknown id', () => {
    expect(cards.remove(9999)).toBe(false);
  });

  it('reorder persists the new order', () => {
    const board = boards.create('B');
    const l = lists.create(board.id, 'L');
    const c1 = cards.create(l.id, '1');
    const c2 = cards.create(l.id, '2');
    const c3 = cards.create(l.id, '3');
    cards.reorder(l.id, [c3.id, c1.id, c2.id]);
    expect(cards.list(l.id).map((x) => x.title)).toEqual(['3', '1', '2']);
  });

  describe('move', () => {
    it('appends to the target list when no position is given', () => {
      const board = boards.create('B');
      const l1 = lists.create(board.id, 'L1');
      const l2 = lists.create(board.id, 'L2');
      const c = cards.create(l1.id, 'C');
      const moved = cards.move(l2.id, c.id);
      expect(moved?.list_id).toBe(l2.id);
      expect(cards.list(l1.id)).toHaveLength(0);
      const inL2 = cards.list(l2.id);
      expect(inL2.map((x) => x.id)).toEqual([c.id]);
      expect(inL2[0].position).toBe(1);
    });

    it('inserts at the given (0-based) position in the target list', () => {
      const board = boards.create('B');
      const l1 = lists.create(board.id, 'L1');
      const l2 = lists.create(board.id, 'L2');
      cards.create(l2.id, 'X'); // target position 1
      cards.create(l2.id, 'Y'); // target position 2
      const moved = cards.create(l1.id, 'M');
      cards.move(l2.id, moved.id, 1); // insert at index 1 -> X, M, Y
      expect(cards.list(l2.id).map((x) => x.title)).toEqual(['X', 'M', 'Y']);
    });

    it('reorders within the same list', () => {
      const board = boards.create('B');
      const l = lists.create(board.id, 'L');
      cards.create(l.id, '1');
      cards.create(l.id, '2');
      const c3 = cards.create(l.id, '3');
      cards.move(l.id, c3.id, 0); // move to front
      expect(cards.list(l.id).map((x) => x.title)).toEqual(['3', '1', '2']);
    });

    it('re-normalizes the source list after a cross-list move', () => {
      const board = boards.create('B');
      const l1 = lists.create(board.id, 'L1');
      const l2 = lists.create(board.id, 'L2');
      cards.create(l1.id, 'A'); // pos 1
      const b = cards.create(l1.id, 'B'); // pos 2
      cards.create(l1.id, 'C'); // pos 3
      cards.move(l2.id, b.id); // move B out
      expect(cards.list(l1.id).map((x) => x.title)).toEqual(['A', 'C']);
      expect(cards.list(l1.id).map((x) => x.position)).toEqual([1, 2]);
    });

    it('returns undefined when the card does not exist', () => {
      const board = boards.create('B');
      const l = lists.create(board.id, 'L');
      expect(cards.move(l.id, 99999)).toBeUndefined();
    });

    it('returns undefined when the target list does not exist', () => {
      const board = boards.create('B');
      const l = lists.create(board.id, 'L');
      const c = cards.create(l.id, 'C');
      expect(cards.move(99999, c.id)).toBeUndefined();
    });

    it('clamps an out-of-range position to the end (append)', () => {
      const board = boards.create('B');
      const l1 = lists.create(board.id, 'L1');
      const l2 = lists.create(board.id, 'L2');
      cards.create(l2.id, 'X');
      cards.create(l2.id, 'Y');
      const moved = cards.create(l1.id, 'M');
      cards.move(l2.id, moved.id, 9999);
      expect(cards.list(l2.id).map((c) => c.title)).toEqual(['X', 'Y', 'M']);
    });
  });
});
