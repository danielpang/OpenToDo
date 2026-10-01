import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { getDb } from './db';
import { toNodeHandler } from 'better-auth/node';
import { apiErrorHandler, router as apiRouter } from './routes';
import { getAuth } from './auth';

// Application factory: builds and returns the Express app. Kept as a function so that
// later leaves (e.g. L1 DB init, L2 router mount) can wire up middleware/routes before
// the app starts, and so tests can construct a fresh app if needed.
const createApp = (): Express => {
  const app: Express = express();

  app.use(cors());

  // L1: better-auth auth routes (OAuth callbacks, sign-in/out, get-session, ...)
  // live at /api/auth (better-auth's default basePath). The mount is registered
  // BEFORE express.json() so better-auth can read raw request bodies as it
  // expects. The handler closure calls getAuth() lazily per request, so
  // createApp() / importing `app` stays DB-free; the auth instance is only
  // constructed when an /api/auth/* route is actually hit.
  app.get('/api/auth/ok', (_req: Request, res: Response) => {
    res.json({ ok: true, auth: true });
  });
  app.use('/api/auth', (req: Request, res: Response, next: NextFunction) => {
    toNodeHandler(getAuth())(req, res).catch(next);
  });

  app.use(express.json());

  // Health endpoint — the single behaviour this scaffold owns.
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // L2: REST API routes (boards, lists, cards) mounted at /api.
  app.use('/api', apiRouter);

  // L2: translates ApiError (400/404/…) thrown by route handlers into the
  // contract's `{ error }` JSON body. Unexpected errors fall through to the
  // 500 handler below.
  app.use(apiErrorHandler);

  // 404 handler — must be registered after all routes so it catches unmatched paths.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // 500 error handler — Express identifies it by its 4-arg signature.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
};

const app = createApp();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// Start the server only when this module is executed directly (e.g. `tsx src/index.ts`),
// not when it is imported by tests/Supertest, which would collide on the port.
if (require.main === module) {
  // Ensure the shared on-disk database exists and its schema is migrated on
  // startup. createApp() stays DB-free so importing `app` (e.g. in tests)
  // does not touch the filesystem.
  getDb();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export { app, createApp };
