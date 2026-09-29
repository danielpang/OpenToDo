import { useState, type FormEvent, type ReactNode, useRef } from 'react';

export interface CardFormProps {
  /** Pre-filled title (edit mode) or empty string (new card). */
  initialTitle?: string;
  /** Pre-filled description (edit mode) or empty string. */
  initialDescription?: string;
  submitLabel?: string;
  /** Called on valid submit with trimmed values. An async rejection surfaces inline. */
  onSubmit: (title: string, description?: string) => Promise<void> | void;
  onCancel: () => void;
  /** Callback invoked after a *successful* submission (e.g. to collapse the form). */
  onSuccess?: () => void;
  /** Optional leading element, e.g. a label or icon. */
  children?: ReactNode;
}

/**
 * A small, focused card title/description form shared by the inline "add card"
 * flow and the card detail edit flow. Mirrors the validation style used by
 * `NewBoardDialog` ("Title is required") and reuses the shared input styling.
 */
export default function CardForm({
  initialTitle = '',
  initialDescription = '',
  submitLabel = 'Save',
  onSubmit,
  onCancel,
  onSuccess,
  children,
}: CardFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      titleRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(trimmed, description ? description.trim() : undefined);
      onSuccess?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-card-form className="mt-2 space-y-2.5">
      {children}
      <div className="flex flex-col gap-2">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Card title"
          aria-label="Card title"
          disabled={submitting}
          className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description (optional)"
          aria-label="Card description"
          disabled={submitting}
          rows={3}
          className="w-full resize-y rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          aria-label={submitLabel}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
