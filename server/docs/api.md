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

OAuth is driven through BetterAuth's **social sign-in** endpoint, which is a
plain JSON `POST` that returns the provider's authorize URL — it does **not**
issue a `302` redirect itself. The client navigates the browser to the returned
`url`; BetterAuth then catches the provider's callback and finally redirects
the user back to the app.

```
POST /api/auth/sign-in/social
Origin: http://localhost:5173            # app origin (must be a trusted origin)
Content-Type: application/json

{
  "provider": "google",
  "callbackURL": "http://localhost:5173/"  # browser is sent here after OAuth
}
```

- **Status:** `200 OK` (not `302`).
- **Body:** `{"url":"<provider authorize URL>","redirect":true}`,
  `Content-Type: application/json`.
- **`Location` header:** set to the same provider authorize URL, *unless*
  `disableRedirect` is set (see below).
- **The returned `url`** is the provider's OAuth authorize endpoint and already
  embeds `state`, PKCE (`code_challenge` / `code_challenge_method=S256`),
  `redirect_uri=<BETTER_AUTH_URL>/api/auth/callback/<provider>`, and the
  requested `scope`.
- **`disableRedirect: true`** (body field) → `200` with
  `{"url":"...","redirect":false}` and **no** `Location` header; use this when
  the client wants to drive the redirect itself.

After the browser is sent to `url`, the provider authenticates the user and
redirects back to BetterAuth's callback:

```
GET|POST /api/auth/callback/<provider>?code=…&state=…   # handled by BetterAuth
```

The callback route exchanges the `code` server-side for tokens (replaying the
PKCE `codeVerifier`), creates/updates the session, **sets the
`better-auth.session_token` cookie**, and then `302`-redirects the browser to
the **posted `callbackURL`** (an app route such as `http://localhost:5173/`).
That `callbackURL` is validated against `trustedOrigins` (see *Trusted origins*
below); if it is not trusted the sign-in `POST` is rejected with
`403 INVALID_CALLBACK_URL` before any authorize URL is generated. Note that
`callbackURL` is the **app-side return target** — it is *not* the OAuth
`redirect_uri` (which is always `<BETTER_AUTH_URL>/api/auth/callback/<provider>`).

**Other supported body fields** (optional): `disableRedirect`, `idToken` (for
providers that support id-token sign-in — returns
`{"redirect":false,"token":"…","user":{}}`), `scopes`, `loginHint`,
`additionalParams` (merged into the authorize URL; reserved OAuth keys such as
`state`, `code_challenge`, `redirect_uri` are rejected), and `additionalData`.

**Signed (idToken) sign-in** sends an id token instead of redirecting to the
provider:

```
POST /api/auth/sign-in/social
Content-Type: application/json

{ "provider": "google", "callbackURL": "http://localhost:5173/", "idToken": { "token": "...", "nonce": "..." } }
```

- **Status:** `200 OK`
- **Body:** `{"redirect":false,"token":"<session token>","user":{…}}` (no
  `Location`). Errors here surface as `401` — `INVALID_TOKEN`,
  `FAILED_TO_GET_USER_INFO`, or `USER_EMAIL_NOT_FOUND` — and `403`
  `EMAIL_NOT_VERIFIED` (provider returned an unverified email).

**Trusted origins.** BetterAuth validates the request `Origin` (on
cookie/CSRF-protected requests) and the posted `callbackURL` against
`trustedOrigins`. The set defaults to the **`BETTER_AUTH_URL` origin only**
(i.e. `http://localhost:4000`). It is **not** automatically widened for
`localhost`/`127.0.0.1` on other ports, so the Vite dev front-end on
`http://localhost:5173` is *untrusted by default* and OAuth `POST`s from it fail
with `403 INVALID_CALLBACK_URL`. Add it (and any other app origin) with:

- the `BETTER_AUTH_TRUSTED_ORIGINS` env var (comma-separated, auto-loaded by
  BetterAuth — see `server/.env.example`), e.g.
  `BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:5173`, or
- the `trustedOrigins` array in `server/src/auth.ts`.

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
| `403` | OAuth trust gate on the sign-in `POST`: `INVALID_ORIGIN` (the request `Origin` is not in `trustedOrigins`) or `INVALID_CALLBACK_URL` (the posted `callbackURL` is not in `trustedOrigins`). Both default to permitting only the `BETTER_AUTH_URL` origin. | `{ "message": "Invalid origin" \| "Invalid callbackURL", "code": "INVALID_ORIGIN" \| "INVALID_CALLBACK_URL" }` |
| `403` | A cookie-bearing / CSRF-protected `POST` whose `Origin` header does not match a trusted origin (general CSRF gate). | `{ "error": "Unauthorized" }` or a provider message |

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
