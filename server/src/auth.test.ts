import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestInstance } from 'better-auth/test';
import { DatabaseSync } from 'node:sqlite';
import express, { Express, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { app as serverApp } from './index';
import { createAuth, setAuth } from './auth';
import { requireAuth } from './middleware/requireAuth';

describe('auth bootstrap', () => {
  describe('createAuth factory', () => {
    it('constructs a better-auth instance (boots)', () => {
      const auth = createAuth(new DatabaseSync(':memory:'));
      expect(auth).toBeDefined();
      expect(typeof auth.api.getSession).toBe('function');
      expect(typeof auth.handler).toBe('function');
    });

    it('boots even when social-provider env vars are absent', () => {
      expect(() => createAuth(new DatabaseSync(':memory:'))).not.toThrow();
    });
  });

  describe('mounted auth on the real server app', () => {
    it('GET /api/auth/ok → 200 { ok, auth }', async () => {
      // The /api/auth/ok route is registered before the better-auth mount and
      // does not touch the auth DB, so the real app must answer without
      // constructing an auth instance (DB-free at request time).
      const res = await request(serverApp).get('/api/auth/ok');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, auth: true });
    });
  });

  describe('requireAuth guard', () => {
    let testApp: Express;
    let ba: Awaited<ReturnType<typeof getTestInstance>>;

    beforeAll(async () => {
      // getTestInstance builds a migrated, in-memory auth instance and seeds a
      // test user — no network (telemetry is a no-op). setAuth() makes the
      // guard's getAuth() share this instance so the session cookie validates.
      ba = await getTestInstance({});
      setAuth(ba.auth);

      testApp = express();
      testApp.use(express.json());
      testApp.get('/api/private', requireAuth, (_req: Request, res: Response) => {
        res.json({ ok: true });
      });
      testApp.use((_req: Request, res: Response) => {
        res.status(404).json({ error: 'Not Found' });
      });
      testApp.use(
        (_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
          res.status(500).json({ error: 'Internal Server Error' });
        },
      );
    });

    afterAll(() => {
      setAuth(null);
    });

    it('→ 401 without a session', async () => {
      const res = await request(testApp).get('/api/private');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthenticated' });
    });

    it('→ 200 with a testUtils-minted session', async () => {
      const { headers } = await ba.signInWithTestUser();
      const cookie = headers.get('cookie') as string;
      const res = await request(testApp).get('/api/private').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });
});
