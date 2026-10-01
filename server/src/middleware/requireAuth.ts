import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { getAuth } from '../auth';

/**
 * Express guard that rejects requests without an authenticated better-auth
 * session with `401 { error: 'Unauthenticated' }`. On success, attaches the
 * session and user to `res.locals` for downstream handlers and calls `next()`.
 *
 * `fromNodeHeaders` converts Express/raw Node headers into a `Headers` init
 * object that `auth.api.getSession` accepts (raw `IncomingHttpHeaders` is not a
 * valid `HeadersInit` under strict TypeScript).
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await getAuth().api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.session) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    res.locals.user = session.user;
    res.locals.session = session.session;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthenticated' });
  }
};
