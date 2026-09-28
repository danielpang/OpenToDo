import { Router } from 'express';
import { boards, lists } from '../models/repos';
import type { List, ListPatch } from '../models/repos';
import {
  asId,
  badRequest,
  bodyObject,
  notFound,
  parseIdParam,
  requireNonEmptyString,
} from './apiError';

export const listsRouter = Router();

/** Project a List DB row to the camelCase API DTO. */
function toList(l: List) {
  return { id: l.id, boardId: l.board_id, title: l.title, position: l.position };
}

listsRouter.post('/', (req, res) => {
  const body = bodyObject(req);
  const boardId = asId(body.boardId, 'boardId');
  if (!boards.get(boardId)) throw notFound('board not found');
  const title = requireNonEmptyString(body.title, 'title');
  res.status(201).json(toList(lists.create(boardId, title)));
});

listsRouter.patch('/:id', (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!lists.get(id)) throw notFound('list not found');
  const body = bodyObject(req);
  const patch: ListPatch =
    body.title === undefined ? {} : { title: requireNonEmptyString(body.title, 'title') };
  const updated = lists.update(id, patch);
  if (!updated) throw notFound('list not found');
  res.json(toList(updated));
});

listsRouter.delete('/:id', (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!lists.remove(id)) throw notFound('list not found');
  res.status(204).end();
});

listsRouter.post('/reorder', (req, res) => {
  const body = bodyObject(req);
  const boardId = asId(body.boardId, 'boardId');
  if (!boards.get(boardId)) throw notFound('board not found');
  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((v) => Number.isInteger(v) && v > 0)) {
    throw badRequest('ids must be a non-empty array of positive integers');
  }
  lists.reorder(boardId, ids as number[]);
  res.json(lists.list(boardId).map(toList));
});
