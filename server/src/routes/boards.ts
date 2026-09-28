import { Router } from 'express';
import { boards } from '../models/repos';
import type { Board, BoardPatch } from '../models/repos';
import { bodyObject, notFound, parseIdParam, requireNonEmptyString } from './apiError';

export const boardsRouter = Router();

/** Project a Board DB row to the camelCase API DTO. */
function toBoard(b: Board) {
  return { id: b.id, title: b.title, position: b.position, createdAt: b.created_at };
}

boardsRouter.get('/', (_req, res) => {
  res.json(boards.list().map(toBoard));
});

boardsRouter.post('/', (req, res) => {
  const body = bodyObject(req);
  const title = requireNonEmptyString(body.title, 'title');
  res.status(201).json(toBoard(boards.create(title)));
});

boardsRouter.get('/:id', (req, res) => {
  const id = parseIdParam(req.params.id);
  const board = boards.get(id);
  if (!board) throw notFound('board not found');
  res.json(toBoard(board));
});

boardsRouter.patch('/:id', (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!boards.get(id)) throw notFound('board not found');
  const body = bodyObject(req);
  const patch: BoardPatch =
    body.title === undefined ? {} : { title: requireNonEmptyString(body.title, 'title') };
  const updated = boards.update(id, patch);
  if (!updated) throw notFound('board not found');
  res.json(toBoard(updated));
});

boardsRouter.delete('/:id', (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!boards.remove(id)) throw notFound('board not found');
  res.status(204).end();
});
