import { Router } from 'express';
import { apiErrorHandler } from './apiError';
import { boardsRouter } from './boards';
import { cardsRouter } from './cards';
import { listsRouter } from './lists';
import { requireAuth } from '../middleware/requireAuth';

export const router = Router();

// Gate the boards/lists/cards REST namespace behind an authenticated
// better-auth session. `requireAuth` runs before each sub-router's handlers:
// it returns 401 `{ error: 'Unauthenticated' }` for unauthenticated requests
// and attaches `res.locals.user` / `res.locals.session` for authenticated ones.
router.use('/boards', requireAuth, boardsRouter);
router.use('/lists', requireAuth, listsRouter);
router.use('/cards', requireAuth, cardsRouter);

export { apiErrorHandler };
