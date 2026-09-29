import { useEffect, useState } from 'react';
import type { Card, UpdateCardRequest } from '../types';
import CardForm from './CardForm';

export interface CardDetailProps {
  card: Card;
  onClose: () => void;
  onUpdate: (card: Card, patch: UpdateCardRequest) => Promise<void>;
  onRemove: (card: Card) => void;
}

const XIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M3 3l8 8M11 3L3 11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * A modal detail panel for a card. Mirrors the controlled `open`/`onClose`
 * dialog pattern used by `NewBoardDialog`: Escape and click-away dismiss it,
 * and inline validation ("Title is required") is delegated to `CardForm`.
 */
export default function CardDetail({ card, onClose, onUpdate, onRemove }: CardDetailProps) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="card-detail-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {card.title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mt-1 -mr-1 rounded p-1 text-slate-400 hover:text-slate-600"
          >
            <XIcon />
          </button>
        </header>

        {card.description ? (
          <p className="mb-4 text-sm text-slate-700 dark:text-slate-300">
            {card.description}
          </p>
        ) : (
          <p className="mb-4 text-sm text-slate-400 italic">No description</p>
        )}

        {editing ? (
          <CardForm
            initialTitle={card.title}
            initialDescription={card.description}
            submitLabel="Save"
            onSubmit={(title, description) =>
              onUpdate(card, { title, description })
            }
            onCancel={() => setEditing(false)}
            onSuccess={() => {
              setEditing(false);
              onClose();
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            Edit
          </button>
        )}

        <button
          type="button"
          onClick={() => onRemove(card)}
          className="ml-auto mt-4 flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-100"
        >
          <XIcon />
          Delete
        </button>
      </div>
    </div>
  );
}
