import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { openDatabase, initDb, setDb, closeDb } from '../db';

beforeEach(() => {
  const db = openDatabase(':memory:');
  initDb(db);
  setDb(db);
});

afterEach(() => {
  closeDb();
});

describe('GET /api/boards', () => {
  it('returns an empty array initially', async () => {
    const res = await request(app).get('/api/boards');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns boards ordered by position', async () => {
    await request(app).post('/api/boards').send({ title: 'A' });
    await request(app).post('/api/boards').send({ title: 'B' });
    const res = await request(app).get('/api/boards');
    expect(res.status).toBe(200);
    expect(res.body.map((b: { title: string }) => b.title)).toEqual(['A', 'B']);
    expect(res.body[0]).toMatchObject({ title: 'A', position: 1 });
  });
});

describe('POST /api/boards', () => {
  it('creates a board and returns 201 with the projected shape', async () => {
    const res = await request(app).post('/api/boards').send({ title: 'My Board' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      title: 'My Board',
      position: 1,
      createdAt: expect.any(String),
    });
  });

  it('returns 400 when the title is missing', async () => {
    const res = await request(app).post('/api/boards').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('returns 400 when the title is not a string', async () => {
    const res = await request(app).post('/api/boards').send({ title: 123 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/boards/:id', () => {
  it('returns the requested board', async () => {
    const created = await request(app).post('/api/boards').send({ title: 'B1' });
    const res = await request(app).get(`/api/boards/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body).toMatchObject({ title: 'B1', position: 1 });
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/boards/9999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).get('/api/boards/abc');
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/boards/:id', () => {
  it('updates the title and returns the board', async () => {
    const created = await request(app).post('/api/boards').send({ title: 'Old' });
    const res = await request(app).patch(`/api/boards/${created.body.id}`).send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/api/boards/9999').send({ title: 'New' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when the title is invalid', async () => {
    const created = await request(app).post('/api/boards').send({ title: 'B' });
    const res = await request(app).patch(`/api/boards/${created.body.id}`).send({ title: 42 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/boards/:id', () => {
  it('deletes the board and returns 204', async () => {
    const created = await request(app).post('/api/boards').send({ title: 'B' });
    const res = await request(app).delete(`/api/boards/${created.body.id}`);
    expect(res.status).toBe(204);
    const again = await request(app).get(`/api/boards/${created.body.id}`);
    expect(again.status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/api/boards/9999');
    expect(res.status).toBe(404);
  });
});
