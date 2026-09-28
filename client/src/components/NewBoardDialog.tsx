import { useEffect, useRef, useState, type FormEvent } from 'react';

export interface NewBoardDialogProps {
  /** Whether the dialog is visible. Controlled by the parent. */
  open: boolean;
  /** Raised when the user cancels (close button, Escape, Click-Out, Cancel action). */
  onClose: () => void;
  /** Raised with the validated title when the user submits; awaited by the dialog. */
  onSubmit: (title: string) => Promise<unknown> | void;
}

/**
 * Modal dialog for creating a new board.
 *
 * Validates that the title is non-empty before calling `onSubmit`, surfaces
 * inline validation and submission errors, and closes itself on a successful
 * submission. Uses native ARIA dialog semantics so it is fully queryable in
 * tests (`getByRole('dialog')`) without a portal.
 */
export default function NewBoardDialog({ open, onClose, onSubmit }: NewBoardDialogProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form state and focus the input each time the dialog is opened.
  useEffect(() => {
    if (open) {
      setTitle('');
      setError('');
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }, [open]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-board-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2
          id="new-board-dialog-title"
          className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          New board
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Board title"
              aria-label="Board title"
              disabled={submitting}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
            {error && (
              <p role="alert" className="mt-1 text-sm text-rose-600">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
