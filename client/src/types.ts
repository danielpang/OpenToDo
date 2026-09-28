/**
 * OpenToDo client API types.
 *
 * This file is the canonical client-side mirror of the REST contract documented
 * in `server/docs/api.md`. The server projects SQLite rows (snake_case columns
 * such as `board_id`, `list_id`, `created_at`) into camelCase JSON; every type
 * below matches one of those projections or request bodies exactly.
 *
 * L3/L4: import DTOs from here rather than re-declaring them so the client and
 * server cannot drift. The API client in `./api/client.ts` is typed entirely in
 * terms of these types.
 */

/** A top-level board container. `createdAt` is the server `datetime('now')` string. */
export interface Board {
  id: number;
  title: string;
  position: number;
  createdAt: string;
}

/** A list belonging to a board. */
export interface List {
  id: number;
  boardId: number;
  title: string;
  position: number;
}

/** A card belonging to a list. `description` defaults to `""` when omitted on creation. */
export interface Card {
  id: number;
  listId: number;
  title: string;
  description: string;
  position: number;
}

/** Single health-check response. */
export interface HealthResponse {
  ok: boolean;
}

/** Error body returned by every endpoint on failure: `{ error: message }`. */
export interface ErrorResponse {
  error: string;
}

// ---- Request body types (camelCase) --------------------------------------
// These describe what the client sends. Optional fields use `?` to match the
// server's permissive PATCH semantics (at least one updatable field required).

export interface CreateBoardRequest {
  title: string;
}

export interface UpdateBoardRequest {
  title?: string;
}

export interface CreateListRequest {
  boardId: number;
  title: string;
}

export interface UpdateListRequest {
  title?: string;
}

export interface CreateCardRequest {
  listId: number;
  title: string;
  description?: string;
}

export interface UpdateCardRequest {
  title?: string;
  description?: string;
  /** When supplied, moves the card to another list (appended to that list). */
  listId?: number;
}

export interface MoveCardRequest {
  fromListId: number;
  toListId: number;
  cardId: number;
  /** Optional 0-based insert index in the target list. Omitted = append. */
  position?: number;
}

export interface ReorderListsRequest {
  boardId: number;
  ids: number[];
}

// ---- Patch aliases (mirror the server's *Patch types) --------------------
// Kept as explicit aliases so callers can type-check partial updates at the
// type level before sending them over the wire.

export type BoardPatch = UpdateBoardRequest;
export type ListPatch = UpdateListRequest;
export type CardPatch = UpdateCardRequest;
