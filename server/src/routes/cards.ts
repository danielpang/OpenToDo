import { Router } from 'express';
import { cards, lists } from '../models/repos';
import type { Card, CardPatch } from '../models/repos';
import {
  asId,
  asNonNegativeInt,
  badRequest,
  bodyObject,
  notFound,
  parseIdParam,
  requireNonEmptyString,
  requireString,
} from './apiError';

export const cardsRouter = Router();

/** Project a Card DB row to the camelCase API DTO. */
function toCard(c: Card) {
  return {
    id: c.id,
    listId: c.list_id,
    title: c.title,
    description: c.description,
    position: c.position,
  };
}

cardsRouter.get('/', (req, res) => {
  const listId = asId(req.query.listId, 'listId');
  if (!lists.get(listId)) throw notFound('list not found');
  res.json(cards.list(listId).map(toCard));
});

cardsRouter.post('/', (req, res) => {
  const body = bodyObject(req);
  const listId = asId(body.listId, 'listId');
  if (!lists.get(listId)) throw notFound('list not found');
  const title = requireNonEmptyString(body.title, 'title');
  const description =
    body.description === undefined ? undefined : requireString(body.description, 'description');
  res.status(201).json(toCard(cards.create(listId, title, description)));
});

cardsRouter.patch('/:id', (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!cards.get(id)) throw notFound('card not found');
  const body = bodyObject(req);
  const patch: CardPatch = {};
  if (body.title !== undefined) patch.title = requireNonEmptyString(body.title, 'title');
  if (body.description !== undefined)
    patch.description = requireString(body.description, 'description');
  if (body.listId !== undefined) {
    const target = asId(body.listId, 'listId');
    if (!lists.get(target)) throw notFound('list not found');
    patch.list_id = target;
  }
  const updated = cards.update(id, patch);
  if (!updated) throw notFound('card not found');
  res.json(toCard(updated));
});

cardsRouter.delete('/:id', (req, res) => {
  const id = parseIdParam(req.params.id);
  if (!cards.remove(id)) throw notFound('card not found');
  res.status(204).end();
});

cardsRouter.post('/move', (req, res) => {
  const body = bodyObject(req);
  const cardId = asId(body.cardId, 'cardId');
  const fromListId = asId(body.fromListId, 'fromListId');
  const toListId = asId(body.toListId, 'toListId');

  const card = cards.get(cardId);
  if (!card) throw notFound('card not found');
  if (!lists.get(fromListId)) throw notFound('source list not found');
  if (card.list_id !== fromListId) throw badRequest('card does not belong to fromListId');
  if (!lists.get(toListId)) throw notFound('target list not found');

  let position: number | undefined;
  if (body.position !== undefined) {
    position = asNonNegativeInt(body.position, 'position');
  }
  const moved = cards.move(toListId, cardId, position);
  if (!moved) throw notFound('card or list not found');
  res.json(toCard(moved));
});
