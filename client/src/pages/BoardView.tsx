import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Board, Card, List } from '../types';
import CardDetail from '../components/CardDetail';
import ListColumn from '../components/ListColumn';

/** Move `items[from]` to position `to`, returning a new array. */
function reorder<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500';

const buttonCls =
  'rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/60';

/** The kanban board view, mounted at `/boards/:id`. */
export default function BoardView() {
  const { id } = useParams<{ id: string }>();
  const boardId = Number(id);

  const [board, setBoard] = useState<Board | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [cards, setCards] = useState<Record<number, Card[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [listFormOpen, setListFormOpen] = useState(false);
  const [listTitle, setListTitle] = useState('');

  const [detailCard, setDetailCard] = useState<Card | null>(null);

  const load = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const [fetchedBoard, fetchedLists] = await Promise.all([
        api.boards.get(boardId),
        api.lists.list(boardId),
      ]);
      setBoard(fetchedBoard);
      setLists(fetchedLists);

      const cardsByList: Record<number, Card[]> = {};
      await Promise.all(
        fetchedLists.map(async (list) => {
          cardsByList[list.id] = await api.cards.list(list.id);
        }),
      );
      setCards(cardsByList);
    } catch (thrown) {
      setError(
        thrown instanceof Error ? thrown.message : 'Failed to load board',
      );
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAddCard = useCallback(
    async (listId: number, title: string, description?: string) => {
      const created = await api.cards.create({ listId, title, description });
      setCards((prev) => ({
        ...prev,
        [listId]: [created, ...(prev[listId] ?? [])],
      }));
    },
    [],
  );

  const onUpdateCard = useCallback(
    async (card: Card, patch: Parameters<typeof api.cards.update>[1]) => {
      const updated = await api.cards.update(card.id, patch);
      setCards((prev) => ({
        ...prev,
        [card.listId]:
          prev[card.listId]?.map((candidate) =>
            candidate.id === card.id ? updated : candidate,
          ) ?? [],
      }));
    },
    [],
  );

  const onRemoveCard = useCallback((card: Card) => {
    if (!window.confirm(`Delete "${card.title}"?`)) return;
    void api.cards.remove(card.id);
    setCards((prev) => ({
      ...prev,
      [card.listId]: prev[card.listId]?.filter((c) => c.id !== card.id) ?? [],
    }));
  }, []);

  const onOpenCard = useCallback((card: Card) => setDetailCard(card), []);
  const onCloseDetail = useCallback(() => setDetailCard(null), []);

  const onAddList = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const title = listTitle.trim();
      if (!title) return;
      try {
        const created = await api.lists.create({ boardId, title });
        setLists((prev) => [...prev, created]);
        setCards((prev) => ({ ...prev, [created.id]: [] }));
      } catch {
        // Creation is best-effort; the existing error surface is board load.
      }
      setListTitle('');
      setListFormOpen(false);
    },
    [listTitle, boardId],
  );

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, type } = result;
      if (!destination || !board) return;
      // Dropped back where it started.
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      if (type === 'COLUMN') {
        const reordered = reorder(lists, source.index, destination.index);
        setLists(reordered);
        try {
          await api.lists.reorder({
            boardId: board.id,
            ids: reordered.map((list) => list.id),
          });
        } catch {
          setLists(lists);
        }
        return;
      }

      if (type !== 'CARD') return;

      const listId = Number(source.droppableId.replace('list-', ''));
      const destListId = Number(destination.droppableId.replace('list-', ''));
      const sameList = listId === destListId;

      if (sameList) {
        const current = cards[listId] ?? [];
        const reorderedCards = reorder(current, source.index, destination.index);
        const cardId = current[source.index].id;
        setCards((prev) => ({ ...prev, [listId]: reorderedCards }));
        try {
          await api.cards.move({
            fromListId: listId,
            toListId: listId,
            cardId,
            position: destination.index,
          });
        } catch {
          setCards((prev) => ({ ...prev, [listId]: cards[listId] ?? [] }));
        }
        return;
      }

      const from = [...(cards[listId] ?? [])];
      const to = [...(cards[destListId] ?? [])];
      const [moved] = from.splice(source.index, 1);
      to.splice(destination.index, 0, moved);
      setCards((prev) => ({ ...prev, [listId]: from, [destListId]: to }));
      try {
        await api.cards.move({
          fromListId: listId,
          toListId: destListId,
          cardId: moved.id,
          position: destination.index,
        });
      } catch {
        setCards((prev) => ({
          ...prev,
          [listId]: cards[listId] ?? [],
          [destListId]: cards[destListId] ?? [],
        }));
      }
    },
    [board, lists, cards],
  );

  const railLoading = loading && lists.length === 0;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <section className="flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1
            id="board-title"
            className="text-2xl font-semibold text-slate-900 dark:text-slate-100"
          >
            {board ? board.title : 'Board'}
          </h1>
          <button
            type="button"
            onClick={() => setListFormOpen((open) => !open)}
            aria-expanded={listFormOpen}
            aria-label="Add list"
            className={buttonCls}
          >
            + Add list
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-1 font-medium underline decoration-rose-600 underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {listFormOpen && (
          <form onSubmit={onAddList} className="flex gap-2">
            <input
              value={listTitle}
              onChange={(event) => setListTitle(event.target.value)}
              placeholder="New list title"
              aria-label="List title"
              className={inputCls}
            />
            <button type="submit" disabled={!listTitle.trim()} className={buttonCls}>
              Add
            </button>
          </form>
        )}

        {railLoading ? (
          <BoardSkeleton />
        ) : lists.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No lists yet. Create one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Droppable droppableId="board-columns" type="COLUMN" direction="horizontal">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex items-start gap-3 pb-2"
                >
                  {lists.map((list, index) => (
                    <ListColumn
                      key={list.id}
                      list={list}
                      index={index}
                      cards={cards[list.id] ?? []}
                      onAddCard={onAddCard}
                      onRemoveCard={onRemoveCard}
                      onOpenCard={onOpenCard}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        )}

        {detailCard && (
          <CardDetail
            card={detailCard}
            onClose={onCloseDetail}
            onUpdate={onUpdateCard}
            onRemove={onRemoveCard}
          />
        )}
      </section>
    </DragDropContext>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {[0, 1].map((slot) => (
        <div
          key={slot}
          className="flex w-80 flex-shrink-0 flex-col gap-3 rounded-xl border border-slate-200 bg-slate-100/60 p-3 dark:border-slate-700 dark:bg-slate-800/40"
        >
          <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          <ul className="space-y-2.5">
            {[0, 1, 2].map((card) => (
              <li
                key={card}
                className="h-12 rounded-lg bg-slate-200 dark:bg-slate-700"
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
