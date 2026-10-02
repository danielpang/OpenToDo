# OpenToDo REST API

The OpenToDo server exposes a small REST API for the **Boards → Lists → Cards**
hierarchy. All routes are mounted under `/api` and accept/return JSON with a JSON
content type. Request bodies use **camelCase**; responses are camelCase
projections of the underlying SQLite rows (which use `snake_case` columns such
as `board_id`, `list_id`, `created_at`).

- **Base URL:** `http://localhost:4000/api`
- **Auth:** every resource endpoint below requires a valid BetterAuth session
  (a signed `better-auth.session_token` cookie). Unauthenticated requests are
  rejected with `401`; an invalid/expired session is rejected with `403`. See
  [Authentication](#authentication) below for the sign-in flow.
- **Data model:** a `board` owns `list`s; a `list` owns `card`s.
  Positions are **1-based, dense** within a parent. Deleting a parent
  cascades (via SQLite `ON DELETE CASCADE`) to its children.

## Authentication

Auth is provided by [BetterAuth](https://better-auth.org) and exposed under
`/api/auth`. The server mounts BetterAuth's handler at `/api/auth`
(`toNodeHandler` in `server/src/index.ts`), so all `/api/auth/*` routes are
handled by BetterAuth directly — they are **not** part of the app's own
Express routers.

### Session model

A session is a signed cookie named **`better-auth.session_token`**. The value is
opaque and already URL-safe; send it back verbatim in a request `Cookie` header:

```
Cookie: better-auth.session_token=<token>.<signature>
```

The `requireAuth` middleware (`server/src/middleware/requireAuth.ts`) validates
this cookie on every protected route by calling
`auth.api.getSession({ headers })`. The cookie is **required** on all
`/api/boards`, `/api/lists`, and `/api/cards` endpoints.

### Email / password sign-in

```
POST /api/auth/sign-in/email
Content-Type: application/json
Origin: http://localhost:4000          # CSRF: must match BETTER_AUTH_URL

{ "email": "user@example.com", "password": "••••••", "callbackURL": "/" }
```

- **Status:** `200 OK` (with the session cookie set).
- **On the wire:** the response sets `better-auth.session_token` via `Set-Cookie`
  (signed, `HttpOnly`, `Path=/`). A `403` with body `{ "error": "Username or password is incorrect" }`
  on bad credentials.
- **CSRF note:** the `Origin` header is mandatory on sign-in/sign-up POSTs and
  must match `BETTER_AUTH_URL`; omitting it returns `403 MISSING_OR_NULL_OR_ORIGIN`.
- **Sign-up:** `POST /api/auth/sign-up/email` with the same shape and headers is
  how new email/password users are created (used by the dev flow and the e2e
  suite, which seeds `e2e@test.com`).

### Signing out

```
POST /api/auth/sign-out
```

Clears the session cookie (`Set-Cookie: better-auth.session_token=; Max-Age=0`).

### Inspecting the current session

```
GET /api/auth/get-session
```

Returns the authenticated user/session when the cookie is valid, or `null` when
not. (Mirrors what `requireAuth` checks internally.)

### Social / OAuth providers

BetterAuth's built-in OAuth flows are mounted at:

```
GET /api/auth/sign-in/<provider>      # redirects to the provider
GET /api/auth/oauth2/<provider>       # callback (handled by BetterAuth)
```

Configured providers (each enabled only when both its `id` and `secret` are
set — see `server/.env.example`):

| Provider key | Env vars              | Notes |
|--------------|-----------------------|-------|
| `google`     | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth. |
| `twitter`    | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | Twitter/X. X (formerly Twitter) is configured under BetterAuth's **`twitter`** provider key — set the `TWITTER_*` vars to enable "Sign in with X/Twitter". |

### Error handling reference

| Status | Meaning | Body |
| ------ | ------- | ---- |
| `401` | No `better-auth.session_token` cookie (unauthenticated). | `{ "error": "Unauthenticated" }` |
| `403` | Cookie present but invalid, expired, or a CSRF `Origin` check failed. | `{ "error": "Unauthorized" }` or a provider message |

## Error handling

Every endpoint responds with an error body of the shape `{ "error": "<message>" }`
on failure:

| Status | Meaning                                                     |
| ------ | ----------------------------------------------------------- |
| `400`  | Bad/missing input: malformed body, missing or invalid field.|
| `401`  | No valid session: the `better-auth.session_token` cookie is missing. `{ "error": "Unauthenticated" }` |
| `403`  | Session cookie present but invalid/expired, or a CSRF `Origin` check on a sign-in/sign-up POST failed. `{ "error": "Unauthorized" }` |
| `404`  | The referenced resource (or a foreign-key parent) was found missing. |
| `500`  | Unexpected server error. Logged on the server; body is `{ "error": "Internal Server Error" }`. |

## Boards

A board represents the top-level container.

### `GET /api/boards`

List all boards, ordered by `position`.

- **Status:** `200 OK`
- **Response:** `Board[]`

```json
[
  { "id": 1, "title": "My Board", "position": 1, "createdAt": "2024-01-01 00:00:00" }
]
```

### `POST /api/boards`

Create a board.

- **Request body:** `{ "title": string }`
- **Status:** `201 Created`
- **Response:** `Board`

### `GET /api/boards/:id`

Retrieve a single board.

- **Status:** `200 OK`
- **Response:** `Board`
- **Errors:** `400` if `:id` is non-numeric; `404` if the id is unknown.

### `PATCH /api/boards/:id`

Update a board's title (only `title` is mutable).

- **Request body:** `{ "title"?: string }` (at least one field)
- **Status:** `200 OK`
- **Response:** `Board`
- **Errors:** `400` if `:id` is non-numeric or `title` is not a non-empty string; `404` if unknown.

### `DELETE /api/boards/:id`

Delete a board.

- **Status:** `204 No Content` (empty body)
- **Errors:** `400` if `:id` is non-numeric; `404` if unknown.

## Lists

A list belongs to a board.

### `GET /api/lists?boardId=<number>`

List all lists that belong to a board, ordered by `position`.

- **Query params:** `boardId` (positive integer, required)
- **Status:** `200 OK`
- **Response:** `List[]`
- **Errors:** `400` if `boardId` is missing or not a positive integer; `404` if the board does not exist.

### `POST /api/lists`

Create a list under a board.

- **Request body:** `{ "boardId": number, "title": string }`
- **Status:** `201 Created`
- **Response:** `List`
- **Errors:** `400` if `boardId` is missing/invalid or `title` is missing/empty; `404` if the board does not exist.

### `PATCH /api/lists/:id`

Update a list's title.

- **Request body:** `{ "title"?: string }`
- **Status:** `200 OK`
- **Response:** `List`
- **Errors:** `400` if `:id` is non-numeric or `title` is invalid; `404` if the list is unknown.

### `DELETE /api/lists/:id`

Delete a list. Its cards are **cascade-deleted**.

- **Status:** `204 No Content` (empty body)
- **Errors:** `400` if `:id` is non-numeric; `404` if unknown.

### `POST /api/lists/reorder`

Reorder the lists within a board. Positions are re-normalized to `1..n` to match
the supplied order and **persisted** to the database.

- **Request body:** `{ "boardId": number, "ids": number[] }`
- **Status:** `200 OK`
- **Response:** `List[]` — the board's lists in their new order.
- **Errors:** `400` if `boardId` is invalid or `ids` is missing/empty/not an array of positive integers; `404` if the board does not exist.

## Cards

A card belongs to a list.

### `GET /api/cards?listId=<number>`

List all cards that belong to a list, ordered by `position`.

- **Query params:** `listId` (positive integer, required)
- **Status:** `200 OK`
- **Response:** `Card[]`
- **Errors:** `400` if `listId` is missing or not a positive integer; `404` if the list does not exist.

### `POST /api/cards`

Create a card in a list.

- **Request body:** `{ "listId": number, "title": string, "description"?: string }`
- **Status:** `201 Created`
- **Response:** `Card`
- **Errors:** `400` if `listId` is invalid or `title` is missing/empty; `404` if the list does not exist.

### `PATCH /api/cards/:id`

Update a card. `listId` moves the card to another list (appended to that list).

- **Request body:** `{ "title"?: string, "description"?: string, "listId"?: number }`
- **Status:** `200 OK`
- **Response:** `Card`
- **Errors:** `400` if `:id` is non-numeric or any provided field has an invalid type; `404` if the card is unknown or the target list (when `listId` is supplied) does not exist.

### `DELETE /api/cards/:id`

Delete a card.

- **Status:** `204 No Content` (empty body)
- **Errors:** `400` if `:id` is non-numeric; `404` if unknown.

### `POST /api/cards/move`

Move a card into a list at a position and **persist** the new ordering.

- **Request body:**
  ```json
  { "fromListId": number, "toListId": number, "cardId": number, "position"?: number }
  ```
  `position` is an optional **0-based** insert index; when omitted the card is
  appended to the target list. Positions in both lists are re-normalized.
- **Status:** `200 OK`
- **Response:** `Card` — the moved card in its new location.
- **Errors:** `400` if `cardId`, `fromListId`, or `toListId` is missing/invalid, or if the card does not belong to `fromListId`; `404` if the card or either list is unknown.

## Health

### `GET /api/health`

- **Status:** `200 OK`
- **Response:** `{ "ok": true }`

## DTOs

```ts
interface Board {
  id: number;
  title: string;
  position: number;
  createdAt: string; // datetime('now') string, e.g. "2024-01-01 00:00:00"
}

interface List {
  id: number;
  boardId: number;
  title: string;
  position: number;
}

interface Card {
  id: number;
  listId: number;
  title: string;
  description: string; // defaults to "" when omitted on create
  position: number;
}
```
