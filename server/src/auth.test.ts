import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestInstance } from 'better-auth/test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import express, { Express, NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { app as serverApp } from './index';
import { createAuth, getAuth, initAuth, setAuth } from './auth';
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

  describe('initAuth runtime migrations', () => {
    let dir: string;
    let dbPath: string;
    let originalDbPath: string | undefined;
    let originalSecret: string | undefined;
    let verifyDb: DatabaseSync | null = null;

    beforeAll(() => {
      // Reset the singleton and point BETTER_AUTH_DB_PATH at a fresh temp file
      // so initAuth() migrates a real, file-backed database (not :memory:).
      setAuth(null);
      originalDbPath = process.env.BETTER_AUTH_DB_PATH;
      originalSecret = process.env.BETTER_AUTH_SECRET;
      dir = mkdtempSync(join(tmpdir(), 'better-auth-migrations-'));
      dbPath = join(dir, 'auth.db');
      process.env.BETTER_AUTH_DB_PATH = dbPath;
      // BETTER_AUTH_SECRET must be >= 32 chars for the constructed instance.
      process.env.BETTER_AUTH_SECRET = 'dev-better-auth-secret-replace-in-production';
    });

    afterAll(() => {
      // Restore env + singleton, then close the verification handle and remove
      // the temp database so the working tree stays clean.
      setAuth(null);
      if (originalDbPath === undefined) {
        delete process.env.BETTER_AUTH_DB_PATH;
      } else {
        process.env.BETTER_AUTH_DB_PATH = originalDbPath;
      }
      if (originalSecret === undefined) {
        delete process.env.BETTER_AUTH_SECRET;
      } else {
        process.env.BETTER_AUTH_SECRET = originalSecret;
      }
      verifyDb?.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it('runs BetterAuth migrations on the startup auth DB', async () => {
      await initAuth();
      // Open the file-backed DB with a fresh handle (the singleton holds its
      // own connection) and confirm the four core auth tables were created.
      verifyDb = new DatabaseSync(dbPath);
      const rows = verifyDb
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as Array<{ name: string }>;
      const names = rows.map((r) => r.name);
      expect(names).toEqual(
        expect.arrayContaining(['user', 'session', 'account', 'verification']),
      );
    });

    it('getAuth() returns the migrated singleton', async () => {
      expect(getAuth()).toBe(await initAuth());
    });

    it('createAuth trusts the Vite dev origin', () => {
      const a = createAuth(new DatabaseSync(':memory:'));
      expect((a.options as { trustedOrigins?: string[] }).trustedOrigins).toEqual(
        expect.arrayContaining(['http://localhost:5173']),
      );
    });
  });
});
