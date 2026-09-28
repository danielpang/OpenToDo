import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';

import BoardsPage from '../pages/BoardsPage';
import type { Board } from '../types';

// Mock the API at the module boundary so the page never touches the network.
// (jest-dom matchers are intentionally not used here to match the codebase's
// existing assertion style — `Truthy`/`toBeNull` from vitest core.)
vi.mock('../api/client', () => ({
  __esModule: true,
  api: {
    boards: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  },
}));

// `api` is the mocked object above; `vi.mocked` gives us typed `.mock*` helpers.
import { api } from '../api/client';
const boardsApi = vi.mocked(api.boards);

const boards: Board[] = [
  { id: 1, title: 'Alpha', position: 0, createdAt: '2024-01-01 00:00:00' },
  { id: 2, title: 'Beta', position: 1, createdAt: '2024-02-02 00:00:00' },
];

/** A stand-in for BoardView so we can assert client-side navigation. */
function MockBoardView() {
  const { id } = useParams();
  return <h2>Board {id}</h2>;
}

/**
 * Render BoardsPage within a router that also hosts the board route, so both
 * the list page and navigation targets resolve.
 */
function renderPage(initialEntries = ['/boards']) {
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/boards/:id" element={<MockBoardView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BoardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boardsApi.list.mockReset();
    boardsApi.create.mockReset();
    boardsApi.remove.mockReset();
    boardsApi.get.mockReset();
    boardsApi.update.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders an empty state when no boards exist', async () => {
    boardsApi.list.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/no boards yet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create your first board/i })).toBeTruthy();
  });

  it('renders a board fetched from the API', async () => {
    boardsApi.list.mockResolvedValue(boards);

    renderPage();

    expect(await screen.findByRole('button', { name: 'Alpha' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Beta' })).toBeTruthy();
  });

  it('opens the new board dialog, creates a board, and shows it without a reload', async () => {
    const user = userEvent.setup();
    boardsApi.list.mockResolvedValue([]);
    boardsApi.create.mockResolvedValue({
      id: 99,
      title: 'Project Phoenix',
      position: 2,
      createdAt: '2024-02-02 00:00:00',
    });

    renderPage();

    // Start from the empty state, then open the dialog.
    await screen.findByText(/no boards yet/i);
    await user.click(screen.getByRole('button', { name: 'New board' }));

    // The dialog is visible and has a labelled title.
    expect(await screen.findByRole('dialog', { name: /new board/i })).toBeTruthy();
    expect(screen.getByLabelText(/board title/i)).toBeTruthy();

    // Creating with an empty title is rejected with inline validation.
    await user.click(screen.getByRole('button', { name: /^create$/i }));
    expect(await screen.findByText(/title is required/i)).toBeTruthy();
    expect(boardsApi.create).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /new board/i })).toBeTruthy();

    // Fill in a valid title and submit.
    await user.clear(screen.getByLabelText(/board title/i));
    await user.type(screen.getByLabelText(/board title/i), 'Project Phoenix');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    // The new board appears immediately, the dialog closes, and the list is
    // never re-fetched (i.e. the append happens client-side — no reload).
    expect(await screen.findByRole('button', { name: 'Project Phoenix' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boardsApi.create).toHaveBeenCalledTimes(1);
    expect(boardsApi.create).toHaveBeenCalledWith({ title: 'Project Phoenix' });
    expect(boardsApi.list).toHaveBeenCalledTimes(1);
  });

  it('navigates to /boards/:id when a board tile is clicked', async () => {
    const user = userEvent.setup();
    boardsApi.list.mockResolvedValue(boards);

    renderPage();

    await screen.findByRole('button', { name: 'Alpha' });
    await user.click(screen.getByRole('button', { name: 'Alpha' }));

    expect(screen.getByRole('heading', { name: /board 1/i })).toBeTruthy();
  });

  it('deletes a board and removes it from the list', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    boardsApi.list.mockResolvedValue(boards);
    boardsApi.remove.mockResolvedValue(undefined);

    renderPage();

    await screen.findByRole('button', { name: 'Alpha' });
    await user.click(screen.getByRole('button', { name: 'Delete Alpha' }));

    await waitFor(() => {
      expect(boardsApi.remove).toHaveBeenCalledTimes(1);
      expect(boardsApi.remove).toHaveBeenCalledWith(1);
    });
    expect(confirmSpy).toHaveBeenCalledWith('Delete Alpha?');

    expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Beta' })).toBeTruthy();

    confirmSpy.mockRestore();
  });

  it('cancels deletion when the confirmation is declined', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    boardsApi.list.mockResolvedValue(boards);

    renderPage();

    await screen.findByRole('button', { name: 'Delete Alpha' });
    await user.click(screen.getByRole('button', { name: 'Delete Alpha' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Delete Alpha?');
    });
    expect(boardsApi.remove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeTruthy();

    confirmSpy.mockRestore();
  });

  it('shows an error banner and can retry when the API fails', async () => {
    const user = userEvent.setup();
    boardsApi.list.mockRejectedValue(new Error('Nope from server'));

    renderPage();

    expect(await screen.findByText(/nope from server/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();

    // Retrying re-runs the fetch.
    boardsApi.list.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(boardsApi.list).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/no boards yet/i)).toBeTruthy();
  });
});
