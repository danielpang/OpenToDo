/**
 * Typed OpenToDo REST client.
 *
 * A thin wrapper around `fetch` bound to the `/api` base path. Vite proxies
 * `/api` to the Express server during development (see `client/vite.config.ts`),
 * and in production both the API and the static assets are served from the same
 * origin, so the client always uses a relative base path.
 *
 * Every method is typed against the DTOs in `../types.ts` so callers get
 * end-to-end type safety from the server projection through the network boundary.
 *
 * L3/L4: import `{ api }` (and `ApiError`) from here. The client is framework
 * agnostic (no React) so it can be used from components, hooks, or tests.
 */
import type {
  Board,
  Card,
  CreateBoardRequest,
  CreateCardRequest,
  CreateListRequest,
  ErrorResponse,
  HealthResponse,
  List,
  MoveCardRequest,
  ReorderListsRequest,
  UpdateBoardRequest,
  UpdateCardRequest,
  UpdateListRequest,
} from '../types';

/** Headers attached to every request. */
const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

/** Base path for all API requests. Proxied to the server in dev. */
let baseURL = '/api';

/** The currently-configured API base (default `/api`). */
export function getApiBase(): string {
  return baseURL;
}

/** Point the client at a different origin/base. Intended for tests/e2e. */
export function setApiBase(value: string): void {
  baseURL = value;
}

/**
 * HTTP error carrying the status code and the server's `{ error }` message.
 * `request()` throws this for any non-2xx response so callers can branch on
 * `err.status` (e.g. 400 vs 404).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  /** JSON-serialisable request body. When omitted the method is `GET`. */
  body?: unknown;
  /** Extra `fetch` init (e.g. `{ signal }` for cancellation). */
  init?: RequestInit;
}

/**
 * Core typed request helper. Resolves the parsed JSON body as `T`, or throws an
 * `ApiError` for any non-2xx response. `204 No Content` and empty bodies
 * resolve to `undefined` (cast to `T`), matching the delete endpoints that
 * intentionally return no body.
 */
export async function request<T>(path: string, { body, init }: RequestOptions = {}): Promise<T> {
  // An explicit method wins (PATCH/DELETE); otherwise default to GET for
  // body-less requests and POST when a body is supplied.
  const method = init?.method ?? (body === undefined ? 'GET' : 'POST');
  const res = await fetch(`${baseURL}${path}`, {
    ...init,
    headers: { ...DEFAULT_HEADERS, ...(init?.headers ?? {}) },
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 204 No Content (and any empty body) -> nothing to parse.
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = undefined;
  }

  if (!res.ok) {
    const err = data as ErrorResponse | undefined;
    const message = (err && err.error) || res.statusText || 'Request failed';
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

export const api = {
  health: {
    get: (): Promise<HealthResponse> => request<HealthResponse>('/health'),
  },

  boards: {
    list: (): Promise<Board[]> => request<Board[]>('/boards'),
    get: (id: number): Promise<Board> => request<Board>(`/boards/${id}`),
    create: (body: CreateBoardRequest): Promise<Board> => request<Board>('/boards', { body }),
    update: (id: number, body: UpdateBoardRequest): Promise<Board> =>
      request<Board>(`/boards/${id}`, { body, init: { method: 'PATCH' } }),
    remove: (id: number): Promise<void> =>
      request<void>(`/boards/${id}`, { init: { method: 'DELETE' } }),
  },

  lists: {
    list: (boardId: number): Promise<List[]> =>
      request<List[]>(`/lists?boardId=${boardId}`),
    create: (body: CreateListRequest): Promise<List> => request<List>('/lists', { body }),
    update: (id: number, body: UpdateListRequest): Promise<List> =>
      request<List>(`/lists/${id}`, { body, init: { method: 'PATCH' } }),
    remove: (id: number): Promise<void> =>
      request<void>(`/lists/${id}`, { init: { method: 'DELETE' } }),
    reorder: (body: ReorderListsRequest): Promise<List[]> =>
      request<List[]>('/lists/reorder', { body }),
  },

  cards: {
    list: (listId: number): Promise<Card[]> =>
      request<Card[]>(`/cards?listId=${listId}`),
    create: (body: CreateCardRequest): Promise<Card> => request<Card>('/cards', { body }),
    update: (id: number, body: UpdateCardRequest): Promise<Card> =>
      request<Card>(`/cards/${id}`, { body, init: { method: 'PATCH' } }),
    remove: (id: number): Promise<void> =>
      request<void>(`/cards/${id}`, { init: { method: 'DELETE' } }),
    move: (body: MoveCardRequest): Promise<Card> => request<Card>('/cards/move', { body }),
  },
};
