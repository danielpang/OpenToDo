import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';

// Application factory: builds and returns the Express app. Kept as a function so that
// later leaves (e.g. L1 DB init, L2 router mount) can wire up middleware/routes before
// the app starts, and so tests can construct a fresh app if needed.
const createApp = (): Express => {
  const app: Express = express();

  app.use(cors());
  app.use(express.json());

  // Health endpoint — the single behaviour this scaffold owns.
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

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
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export { app, createApp };
