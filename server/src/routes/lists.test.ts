import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { openDatabase, initDb, setDb, closeDb } from '../db';
import { lists, cards } from '../models/repos';

beforeEach(() => {
  const db = openDatabase(':memory:');
  initDb(db);
  setDb(db);
});

afterEach(() => {
  closeDb();
});

async function createBoardAndList(): Promise<{ boardId: number; listId: number }> {
  const board = await request(app).post('/api/boards').send({ title: 'B' });
  const list = await request(app).post('/api/lists').send({ boardId: board.body.id, title: 'L' });
  return { boardId: board.body.id, listId: list.body.id };
}

describe('POST /api/lists', () => {
  it('creates a list and returns 201 with the projected shape', async () => {
    const board = await request(app).post('/api/boards').send({ title: 'B' });
    const res = await request(app)
      .post('/api/lists')
      .send({ boardId: board.body.id, title: 'Todo' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      boardId: board.body.id,
      title: 'Todo',
      position: 1,
    });
  });

  it('returns 400 when boardId is missing', async () => {
    const res = await request(app).post('/api/lists').send({ title: 'L' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when boardId is not a positive integer', async () => {
    const res = await request(app).post('/api/lists').send({ boardId: -1, title: 'L' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the board does not exist', async () => {
    const res = await request(app).post('/api/lists').send({ boardId: 9999, title: 'L' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when the title is missing', async () => {
    const board = await request(app).post('/api/boards').send({ title: 'B' });
    const res = await request(app).post('/api/lists').send({ boardId: board.body.id });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/lists/:id', () => {
  it('updates the title and returns the list', async () => {
    const { boardId, listId } = await createBoardAndList();
    const res = await request(app).patch(`/api/lists/${listId}`).send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
    expect(res.body.boardId).toBe(boardId);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/api/lists/9999').send({ title: 'New' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when the title is invalid', async () => {
    const { listId } = await createBoardAndList();
    const res = await request(app).patch(`/api/lists/${listId}`).send({ title: 42 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/lists/:id', () => {
  it('deletes the list and returns 204', async () => {
    const { listId } = await createBoardAndList();
    const res = await request(app).delete(`/api/lists/${listId}`);
    expect(res.status).toBe(204);
    const again = await request(app).get(`/api/lists/${listId}`);
    expect(again.status).toBe(404);
  });

  it("cascades and deletes the list's cards", async () => {
    const { listId } = await createBoardAndList();
    await request(app).post('/api/cards').send({ listId, title: 'C1' });
    await request(app).post('/api/cards').send({ listId, title: 'C2' });

    await request(app).delete(`/api/lists/${listId}`);

    // Read back directly from storage to confirm the cascade.
    expect(cards.list(listId)).toHaveLength(0);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/api/lists/9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/lists/reorder', () => {
  it('persists the new position order and reads it back', async () => {
    const board = await request(app).post('/api/boards').send({ title: 'B' });
    const boardId = board.body.id;
    const a = await request(app).post('/api/lists').send({ boardId, title: 'A' });
    const b = await request(app).post('/api/lists').send({ boardId, title: 'B' });
    const c = await request(app).post('/api/lists').send({ boardId, title: 'C' });

    const res = await request(app)
      .post('/api/lists/reorder')
      .send({ boardId, ids: [c.body.id, a.body.id, b.body.id] });
    expect(res.status).toBe(200);
    // HTTP read-back reflects the new order.
    expect(res.body.map((l: { id: number }) => l.id)).toEqual([c.body.id, a.body.id, b.body.id]);

    // Genuine read-back from storage.
    expect(lists.list(boardId).map((l) => l.title)).toEqual(['C', 'A', 'B']);
    expect(lists.list(boardId).map((l) => l.position)).toEqual([1, 2, 3]);
  });

  it('returns 400 when ids is missing', async () => {
    const { boardId } = await createBoardAndList();
    const res = await request(app).post('/api/lists/reorder').send({ boardId });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the board does not exist', async () => {
    const res = await request(app)
      .post('/api/lists/reorder')
      .send({ boardId: 9999, ids: [1, 2] });
    expect(res.status).toBe(404);
  });
});
