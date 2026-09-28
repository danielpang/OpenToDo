import { useNavigate } from 'react-router-dom';
import type { Board } from '../types';

export interface BoardCardProps {
  /** The board to render. The card body navigates to `/boards/:id` on click. */
  board: Board;
  /** Raised when the user requests the board be deleted. */
  onDelete: (board: Board) => void;
}

/**
 * A board tile in the `/boards` grid.
 *
 * Clicking the card body navigates to `/boards/:id`; the delete button stops
 * propagation so it never triggers navigation. Fully presentational — all
 * behaviour lives in the parent `BoardsPage` via `onDelete`.
 */
export default function BoardCard({ board, onDelete }: BoardCardProps) {
  const navigate = useNavigate();

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      {/* Trello-style colored header for each board. */}
      <div className="h-1.5 w-full bg-primary" />
      <button
        type="button"
        onClick={() => navigate(`/boards/${board.id}`)}
        className="flex-1 p-6 text-left"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{board.title}</h3>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(board);
        }}
        className="absolute top-2 right-2 rounded-full p-1 text-slate-500 opacity-0 transition-colors duration-200 group-hover:opacity-100 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-300"
        aria-label={`Delete ${board.title}`}
      >
        <XIcon />
      </button>
    </article>
  );
}

/** A minimal × icon, inlined to avoid a dependency on an icon library. */
function XIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
