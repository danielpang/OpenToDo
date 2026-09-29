import { useState } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import type { Card, List } from '../types';
import CardForm from './CardForm';

export interface ListColumnProps {
  list: List;
  /** Rendered position of this column within the board rail (drives DnD ordering). */
  index: number;
  cards: Card[];
  /** Add a card to this list. */
  onAddCard: (listId: number, title: string, description?: string) => Promise<void>;
  /** Delete an existing card (caller decides confirmation). */
  onRemoveCard: (card: Card) => void;
  /** Open a card for inspection/edit. */
  onOpenCard: (card: Card) => void;
}

function GripIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="text-slate-400"
    >
      <circle cx="3.5" cy="3.5" r="1" />
      <circle cx="8" cy="3.5" r="1" />
      <circle cx="12.5" cy="3.5" r="1" />
      <circle cx="3.5" cy="7.5" r="1" />
      <circle cx="8" cy="7.5" r="1" />
      <circle cx="12.5" cy="7.5" r="1" />
      <circle cx="3.5" cy="11.5" r="1" />
      <circle cx="8" cy="11.5" r="1" />
      <circle cx="12.5" cy="11.5" r="1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="text-slate-400 group-hover:text-rose-500"
    >
      <path
        d="M3 3l8 8M11 3L3 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A single kanban column. Owns its own `Draggable` (board-rail reorder via the
 * parent's COLUMN `Droppable`) and hosts an inner CARD `Droppable` for its cards.
 * The `type` attribute is applied to the inner `Droppable` only, never to a
 * `Draggable`, per the dnd contract.
 */
export default function ListColumn({
  list,
  index,
  cards,
  onAddCard,
  onRemoveCard,
  onOpenCard,
}: ListColumnProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <Draggable draggableId={`list-${list.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex w-80 max-w-full flex-shrink-0 flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-100/60 p-3 dark:border-slate-700 dark:bg-slate-800/40 ${
            snapshot.isDragging ? 'ring-2 ring-primary/60' : ''
          }`}
        >
          <header className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {list.title}
            </h3>
            <button
              type="button"
              aria-label={`Move ${list.title}`}
              {...(provided.dragHandleProps ?? {})}
              className="rounded p-1 text-slate-400 hover:text-slate-600"
            >
              <GripIcon />
            </button>
          </header>

          <Droppable droppableId={`list-${list.id}`} type="CARD">
            {(inner) => (
              <ul
                ref={inner.innerRef}
                {...inner.droppableProps}
                className="space-y-1.5"
              >
                {cards.map((card, position) => (
                  <Draggable
                    key={card.id}
                    draggableId={`card-${card.id}`}
                    index={position}
                  >
                    {(cardProvided, cardSnapshot) => (
                      <li
                        ref={cardProvided.innerRef}
                        {...cardProvided.draggableProps}
                        className={`group flex items-start justify-between rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800 ${
                          cardSnapshot.isDragging ? 'ring-1 ring-primary' : ''
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenCard(card)}
                            className="text-left"
                          >
                            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                              {card.title}
                            </span>
                          </button>
                          {card.description ? (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {card.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Move ${card.title}`}
                            {...(cardProvided.dragHandleProps ?? {})}
                            className="rounded p-0.5 text-slate-300 opacity-0 hover:text-slate-600 group-hover:opacity-100"
                          >
                            <GripIcon />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${card.title}`}
                            onClick={() => onRemoveCard(card)}
                            className="rounded p-0.5 text-slate-300 hover:text-rose-500 group-hover:opacity-100"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </li>
                    )}
                  </Draggable>
                ))}
                {inner.placeholder}
              </ul>
            )}
          </Droppable>

          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              aria-label={`Add card to ${list.title}`}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <PlusIcon />
              Add card
            </button>
          ) : (
            <CardForm
              initialTitle=""
              initialDescription=""
              submitLabel="Add card"
              onSubmit={(title, description) =>
                onAddCard(list.id, title, description)
              }
              onCancel={() => setFormOpen(false)}
              onSuccess={() => setFormOpen(false)}
            />
          )}
        </div>
      )}
    </Draggable>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 3v4M7 11V7M9 5.5H5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
