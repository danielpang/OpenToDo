import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Board } from '../types';
import BoardCard from '../components/BoardCard';
import NewBoardDialog from '../components/NewBoardDialog';

/**
 * `/boards`: lists every board as a clickable tile, creates a new board through
 * an inline dialog (appended to the list without a reload), and optimistically
 * removes a board on delete. Clicking a tile navigates to `/boards/:id`.
 */
export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBoards(await api.boards.list());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load boards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = useCallback(async (title: string) => {
    const created = await api.boards.create({ title });
    setBoards((boards) => [...boards, created]);
  }, []);

  const handleDelete = useCallback(async (board: Board) => {
    // `window.confirm` keeps a destructive action intentionally deliberate.
    if (!window.confirm(`Delete ${board.title}?`)) return;
    await api.boards.remove(board.id);
    setBoards((boards) => boards.filter((kept) => kept.id !== board.id));
  }, []);

  const showSkeleton = loading && boards.length === 0;

  return (
    <section className="mx-auto w-full max-w-4xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Boards</h1>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow hover:bg-primary/90"
        >
          <PlusIcon />
          <span>New board</span>
        </button>
      </header>

      {showSkeleton ? (
        <BoardsSkeleton />
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200"
            >
              <p className="break-words">{error}</p>
              <button
                type="button"
                onClick={load}
                className="mt-1.5 font-medium text-rose-800 underline hover:text-rose-900 dark:text-rose-200"
              >
                Retry
              </button>
            </div>
          )}
          {!error && boards.length === 0 && <EmptyState onCreate={() => setDialogOpen(true)} />}
          {!error && boards.length > 0 && <BoardGrid boards={boards} onDelete={handleDelete} />}
        </>
      )}

      <NewBoardDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
      />
    </section>
  );
}

function BoardGrid({ boards, onDelete }: { boards: Board[]; onDelete: (board: Board) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {boards.map((board) => (
        <BoardCard key={board.id} board={board} onDelete={onDelete} />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-surface-alt py-12 text-center dark:border-slate-700 dark:bg-slate-800"
      aria-label="No boards yet"
    >
      <ClipboardIcon />
      <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">
        No boards yet — add one to get started.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
      >
        Create your first board
      </button>
    </div>
  );
}

function BoardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

/** A small ＋ icon, inlined to avoid an icon-library dependency. */
function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** A minimal clipboard icon for the empty state. */
function ClipboardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400 dark:text-slate-500"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="8" y1="2" x2="16" y2="2" />
      <line x1="12" y1="8" x2="12" y2="14" />
    </svg>
  );
}
