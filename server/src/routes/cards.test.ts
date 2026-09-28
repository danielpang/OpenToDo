import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { openDatabase, initDb, setDb, closeDb } from '../db';
import { cards } from '../models/repos';

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

describe('POST /api/cards', () => {
  it('creates a card and returns 201 with the projected shape', async () => {
    const { listId } = await createBoardAndList();
    const res = await request(app)
      .post('/api/cards')
      .send({ listId, title: 'Card', description: 'note' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      listId,
      title: 'Card',
      description: 'note',
      position: 1,
    });
  });

  it('defaults description to an empty string when omitted', async () => {
    const { listId } = await createBoardAndList();
    const res = await request(app).post('/api/cards').send({ listId, title: 'Card' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('');
  });

  it('returns 400 when listId is missing', async () => {
    const res = await request(app).post('/api/cards').send({ title: 'C' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the list does not exist', async () => {
    const res = await request(app).post('/api/cards').send({ listId: 9999, title: 'C' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when title is missing', async () => {
    const { listId } = await createBoardAndList();
    const res = await request(app).post('/api/cards').send({ listId });
    expect(res.status).toBe(400);
  });

  it('returns 400 when description is not a string', async () => {
    const { listId } = await createBoardAndList();
    const res = await request(app)
      .post('/api/cards')
      .send({ listId, title: 'C', description: 123 });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/cards/:id', () => {
  it('updates the title and description', async () => {
    const { listId } = await createBoardAndList();
    const card = await request(app).post('/api/cards').send({ listId, title: 'Old' });
    const res = await request(app)
      .patch(`/api/cards/${card.body.id}`)
      .send({ title: 'New', description: 'desc' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
    expect(res.body.description).toBe('desc');
  });

  it('moves a card to another list and reads the new state back from storage', async () => {
    const { boardId, listId } = await createBoardAndList();
    const l2 = await request(app).post('/api/lists').send({ boardId, title: 'L2' });
    const card = await request(app).post('/api/cards').send({ listId, title: 'C' });

    const res = await request(app).patch(`/api/cards/${card.body.id}`).send({ listId: l2.body.id });
    expect(res.status).toBe(200);
    expect(res.body.listId).toBe(l2.body.id);

    // Read back from storage: source list is empty, target list has the card.
    expect(cards.list(listId).map((c) => c.id)).toEqual([]);
    const inL2 = cards.list(l2.body.id);
    expect(inL2.map((c) => c.id)).toEqual([card.body.id]);
    expect(inL2[0].position).toBe(1);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/api/cards/9999').send({ title: 'New' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the target list does not exist', async () => {
    const { listId } = await createBoardAndList();
    const card = await request(app).post('/api/cards').send({ listId, title: 'C' });
    const res = await request(app).patch(`/api/cards/${card.body.id}`).send({ listId: 9999 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/cards/:id', () => {
  it('deletes a card and returns 204', async () => {
    const { listId } = await createBoardAndList();
    const card = await request(app).post('/api/cards').send({ listId, title: 'C' });
    const res = await request(app).delete(`/api/cards/${card.body.id}`);
    expect(res.status).toBe(204);
    expect(cards.list(listId)).toHaveLength(0);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/api/cards/9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/cards/move', () => {
  it('moves a card between lists and reads positions back from storage', async () => {
    const { boardId, listId } = await createBoardAndList();
    const l2 = await request(app).post('/api/lists').send({ boardId, title: 'L2' });
    const c1 = await request(app).post('/api/cards').send({ listId, title: 'C1' });
    await request(app).post('/api/cards').send({ listId: l2.body.id, title: 'C2' });
    await request(app).post('/api/cards').send({ listId: l2.body.id, title: 'C3' });

    // Insert c1 at index 1 within L2 (0-based): [C2, C1, C3]
    const res = await request(app).post('/api/cards/move').send({
      fromListId: listId,
      toListId: l2.body.id,
      cardId: c1.body.id,
      position: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.listId).toBe(l2.body.id);
    expect(res.body.title).toBe('C1');

    // Read back from storage.
    expect(cards.list(listId).map((c) => c.id)).toEqual([]);
    expect(cards.list(l2.body.id).map((c) => c.title)).toEqual(['C2', 'C1', 'C3']);
    expect(cards.list(l2.body.id).map((c) => c.position)).toEqual([1, 2, 3]);
  });

  it('reorders within the same list and reads positions back from storage', async () => {
    const { listId } = await createBoardAndList();
    await request(app).post('/api/cards').send({ listId, title: '1' });
    await request(app).post('/api/cards').send({ listId, title: '2' });
    const c3 = await request(app).post('/api/cards').send({ listId, title: '3' });

    const res = await request(app).post('/api/cards/move').send({
      fromListId: listId,
      toListId: listId,
      cardId: c3.body.id,
      position: 0,
    });
    expect(res.status).toBe(200);
    expect(cards.list(listId).map((c) => c.title)).toEqual(['3', '1', '2']);
    expect(cards.list(listId).map((c) => c.position)).toEqual([1, 2, 3]);
  });

  it('appends to the target list when position is omitted', async () => {
    const { boardId, listId } = await createBoardAndList();
    const l2 = await request(app).post('/api/lists').send({ boardId, title: 'L2' });
    const c1 = await request(app).post('/api/cards').send({ listId, title: 'C1' });
    await request(app).post('/api/cards').send({ listId: l2.body.id, title: 'C2' });

    const res = await request(app)
      .post('/api/cards/move')
      .send({ fromListId: listId, toListId: l2.body.id, cardId: c1.body.id });
    expect(res.status).toBe(200);
    expect(cards.list(l2.body.id).map((c) => c.title)).toEqual(['C2', 'C1']);
  });

  it('returns 400 when cardId is missing', async () => {
    const { listId } = await createBoardAndList();
    const res = await request(app)
      .post('/api/cards/move')
      .send({ fromListId: listId, toListId: listId });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the card is not in fromListId', async () => {
    const { boardId, listId } = await createBoardAndList();
    const l2 = await request(app).post('/api/lists').send({ boardId, title: 'L2' });
    const card = await request(app).post('/api/cards').send({ listId: l2.body.id, title: 'C' });
    const res = await request(app).post('/api/cards/move').send({
      fromListId: listId,
      toListId: l2.body.id,
      cardId: card.body.id,
      position: 0,
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the card does not exist', async () => {
    const { listId } = await createBoardAndList();
    const res = await request(app).post('/api/cards/move').send({
      fromListId: listId,
      toListId: listId,
      cardId: 9999,
      position: 0,
    });
    expect(res.status).toBe(404);
  });
});
