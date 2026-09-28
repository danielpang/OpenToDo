import { Router } from 'express';
import { apiErrorHandler } from './apiError';
import { boardsRouter } from './boards';
import { cardsRouter } from './cards';
import { listsRouter } from './lists';

export const router = Router();

router.use('/boards', boardsRouter);
router.use('/lists', listsRouter);
router.use('/cards', cardsRouter);

export { apiErrorHandler };
