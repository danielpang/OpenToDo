import { createAuthClient } from 'better-auth/react';

/**
 * Shared BetterAuth React client for the OpenToDo client.
 *
 * This is the client-side counterpart of the server's auth instance in
 * `server/src/auth.ts`, which mounts BetterAuth at `/api/auth`
 * (see `server/src/index.ts`). `createAuthClient` from `better-auth/react`
 * wraps the core client with React-friendly helpers (`useSession` and atom
 * hooks) around the standard `signIn` / `signOut` API.
 *
 * No `baseURL` is passed on purpose: better-auth resolves it at call time from
 * `window.location.origin` plus its default `/api/auth` basePath. In dev that
 * means Vite's `/api` proxy forwards the auth traffic to the Express server on
 * :4000, and in production the client and API share a single origin. The
 * BetterAuth client also issues credential-aware requests
 * (`credentials: 'include'`) by default, so the session cookie the server sets
 * travels on every call.
 *
 * Components import `{ authClient }` from here; tests swap this whole module
 * via `vi.mock` so nothing touches the network.
 */
export const authClient = createAuthClient();

export default authClient;
