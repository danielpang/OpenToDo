import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import request from 'supertest';
import { getTestInstance } from 'better-auth/test';
import { app } from '../index';
import { openDatabase, initDb, setDb, closeDb } from '../db';
import { setAuth } from '../auth';
import { lists, cards } from '../models/repos';

let ba: Awaited<ReturnType<typeof getTestInstance>>;
let authCookie: string;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  // Mint a migrated better-auth test instance and share it with the `requireAuth`
  // guard (which reads the singleton via `getAuth()`) so the session cookie
  // minted below validates against the same backing store.
  ba = await getTestInstance({});
  setAuth(ba.auth);
  const { headers } = await ba.signInWithTestUser();
  authCookie = headers.get('cookie') as string;
});

afterAll(() => {
  setAuth(null);
});

beforeEach(() => {
  const db = openDatabase(':memory:');
  initDb(db);
  setDb(db);
  // A supertest agent persists a default `Cookie` header across every verb on
  // it, so every request below is authenticated. Requests that bypass the agent
  // (no default cookie) stay unauthenticated and are used for the 401 probe.
  agent = request.agent(app);
  agent.set('Cookie', authCookie);
});

afterEach(() => {
  closeDb();
});

async function createBoardAndList(): Promise<{ boardId: number; listId: number }> {
  const board = await agent.post('/api/boards').send({ title: 'B' });
  const list = await agent.post('/api/lists').send({ boardId: board.body.id, title: 'L' });
  return { boardId: board.body.id, listId: list.body.id };
}

describe('GET /api/lists', () => {
  it('returns the board\'s lists ordered by position', async () => {
    const board = await agent.post('/api/boards').send({ title: 'B' });
    const first = await agent
      .post('/api/lists')
      .send({ boardId: board.body.id, title: 'Todo' });
    const second = await agent
      .post('/api/lists')
      .send({ boardId: board.body.id, title: 'Done' });

    const res = await agent.get('/api/lists').query({ boardId: board.body.id });
    expect(res.status).toBe(200);
    expect(res.body.map((l: { title: string }) => l.title)).toEqual(['Todo', 'Done']);
    expect(res.body[0]).toMatchObject({
      id: first.body.id,
      boardId: board.body.id,
      title: 'Todo',
      position: 1,
    });
    expect(res.body[1]).toMatchObject({
      id: second.body.id,
      boardId: board.body.id,
      title: 'Done',
      position: 2,
    });
  });

  it('returns an empty array when the board has no lists', async () => {
    const board = await agent.post('/api/boards').send({ title: 'B' });
    const res = await agent.get('/api/lists').query({ boardId: board.body.id });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 404 when the board does not exist', async () => {
    const res = await agent.get('/api/lists').query({ boardId: 9999 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('returns 400 when boardId is not a positive integer', async () => {
    const res = await agent.get('/api/lists').query({ boardId: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('returns 400 when boardId is missing', async () => {
    const res = await agent.get('/api/lists');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

describe('POST /api/lists', () => {
  it('creates a list and returns 201 with the projected shape', async () => {
    const board = await agent.post('/api/boards').send({ title: 'B' });
    const res = await agent
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
    const res = await agent.post('/api/lists').send({ title: 'L' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when boardId is not a positive integer', async () => {
    const res = await agent.post('/api/lists').send({ boardId: -1, title: 'L' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the board does not exist', async () => {
    const res = await agent.post('/api/lists').send({ boardId: 9999, title: 'L' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when the title is missing', async () => {
    const board = await agent.post('/api/boards').send({ title: 'B' });
    const res = await agent.post('/api/lists').send({ boardId: board.body.id });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/lists/:id', () => {
  it('updates the title and returns the list', async () => {
    const { boardId, listId } = await createBoardAndList();
    const res = await agent.patch(`/api/lists/${listId}`).send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
    expect(res.body.boardId).toBe(boardId);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await agent.patch('/api/lists/9999').send({ title: 'New' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when the title is invalid', async () => {
    const { listId } = await createBoardAndList();
    const res = await agent.patch(`/api/lists/${listId}`).send({ title: 42 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/lists/:id', () => {
  it('deletes the list and returns 204', async () => {
    const { listId } = await createBoardAndList();
    const res = await agent.delete(`/api/lists/${listId}`);
    expect(res.status).toBe(204);
    const again = await agent.get(`/api/lists/${listId}`);
    expect(again.status).toBe(404);
  });

  it("cascades and deletes the list's cards", async () => {
    const { listId } = await createBoardAndList();
    await agent.post('/api/cards').send({ listId, title: 'C1' });
    await agent.post('/api/cards').send({ listId, title: 'C2' });

    await agent.delete(`/api/lists/${listId}`);

    // Read back directly from storage to confirm the cascade.
    expect(cards.list(listId)).toHaveLength(0);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await agent.delete('/api/lists/9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/lists/reorder', () => {
  it('persists the new position order and reads it back', async () => {
    const board = await agent.post('/api/boards').send({ title: 'B' });
    const boardId = board.body.id;
    const a = await agent.post('/api/lists').send({ boardId, title: 'A' });
    const b = await agent.post('/api/lists').send({ boardId, title: 'B' });
    const c = await agent.post('/api/lists').send({ boardId, title: 'C' });

    const res = await agent
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
    const res = await agent.post('/api/lists/reorder').send({ boardId });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the board does not exist', async () => {
    const res = await agent
      .post('/api/lists/reorder')
      .send({ boardId: 9999, ids: [1, 2] });
    expect(res.status).toBe(404);
  });
});

describe('authentication', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/lists').query({ boardId: 1 });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthenticated' });
  });
});
