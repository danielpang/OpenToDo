import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import BoardView from './BoardView';
import type { Board, Card, List } from '../types';

/**
 * We exercise the *real* `api` client (no module mock) so `lists.list` /
 * `cards.list` / `cards.create` go through `request()` end-to-end. Network is
 * faked by stubbing the global `fetch`, mirroring `api/client.test.ts`.
 */
const mockFetch = vi.fn() as Mock;

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

/** Response factory identical in shape to `request()`'s expectations. */
function json(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    headers: new Headers({
      'content-length': String(JSON.stringify(body).length),
    }),
    json: () => Promise.resolve(body),
  };
}

const board: Board = {
  id: 1,
  title: 'My Board',
  position: 0,
  createdAt: '2024-01-01 00:00:00',
};

const lists: List[] = [
  { id: 10, boardId: 1, title: 'Todo', position: 0 },
  { id: 20, boardId: 1, title: 'Done', position: 1 },
];

const cardsInTodo: Card[] = [
  {
    id: 100,
    listId: 10,
    title: 'Task A',
    description: 'First task',
    position: 0,
  },
];

const cardsInDone: Card[] = [];

const createdCard: Card = {
  id: 99,
  listId: 10,
  title: 'Task B',
  description: '',
  position: 0,
};

function buildMockFetch() {
  return (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const [path, query] = url.split('?');

    if (method === 'GET' && path === '/api/boards/1') {
      return Promise.resolve(json(200, board));
    }
    if (method === 'GET' && path === '/api/lists' && query === 'boardId=1') {
      return Promise.resolve(json(200, lists));
    }
    if (method === 'GET' && path === '/api/cards' && query === 'listId=10') {
      return Promise.resolve(json(200, cardsInTodo));
    }
    if (method === 'GET' && path === '/api/cards' && query === 'listId=20') {
      return Promise.resolve(json(200, cardsInDone));
    }
    if (method === 'POST' && path === '/api/cards') {
      return Promise.resolve(json(201, createdCard));
    }
    return Promise.resolve(json(404, { error: 'not found' }));
  };
}

describe('BoardView', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  beforeEach(() => {
    mockFetch.mockImplementation(buildMockFetch());
  });

  it('loads a board with its lists and cards, then creates a card via the real API client', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/boards/1']}>
        <Routes>
          <Route path="/boards/:id" element={<BoardView />} />
        </Routes>
      </MemoryRouter>,
    );

    // Header + lists + cards render from the stubbed fetch responses.
    expect(await screen.findByText('My Board')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'My Board' })).toBeTruthy();
    expect(screen.getByText('Todo')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Task A')).toBeTruthy();

    // The board rail + DnD must not emit React invariant/act warnings.
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // Open the add-card form in the Todo column and submit a new card.
    await user.click(screen.getByRole('button', { name: /add card to todo/i }));
    const titleInput = await screen.findByLabelText('Card title');
    await user.type(titleInput, 'Task B');
    await user.click(screen.getByRole('button', { name: /^add card$/i }));

    // The created card renders immediately (optimistic, client-side append).
    expect(await screen.findByText('Task B')).toBeTruthy();

    // The real `api.cards.create` POST hit the stubbed fetch with the right body.
    const lastCall = mockFetch.mock.calls.at(-1)!;
    expect(lastCall[0]).toBe('/api/cards');
    expect(lastCall[1].method).toBe('POST');
    expect(lastCall[1].body).toBe(JSON.stringify({ listId: 10, title: 'Task B' }));

    // No console errors throughout the full interaction (DnD mount + async flow).
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
