import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './index';

describe('health', () => {
  it('GET /api/health responds with 200 { ok: true }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /api/health sets content-type to json', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('errors', () => {
  it('unknown routes respond with 404 { error }', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not Found' });
  });
});
