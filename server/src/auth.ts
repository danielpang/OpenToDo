import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import type { Auth, BetterAuthOptions } from 'better-auth';

/**
 * Builds the `socialProviders` option from environment variables. Each
 * provider is only included when BOTH its client id and secret are present, so
 * that `createAuth()` still boots (with no providers) outside configured
 * environments such as the test suite.
 */
function getSocialProviders(): BetterAuthOptions['socialProviders'] {
  const out: BetterAuthOptions['socialProviders'] = {};

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (googleClientId && googleClientSecret) {
    out.google = { clientId: googleClientId, clientSecret: googleClientSecret };
  }

  const twitterClientId = process.env.TWITTER_CLIENT_ID;
  const twitterClientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (twitterClientId && twitterClientSecret) {
    out.twitter = { clientId: twitterClientId, clientSecret: twitterClientSecret };
  }

  return out;
}

/**
 * Constructs a better-auth `Auth` instance backed by a `node:sqlite`
 * `DatabaseSync`. Uses an in-memory database by default (or the file path in
 * `BETTER_AUTH_DB_PATH`). Tests inject their own migrated `DatabaseSync` via
 * `getTestInstance`.
 *
 * NOTE: this only constructs the auth object; it does NOT run database
 * migrations. Use `initAuth()` to construct the singleton AND run the
 * BetterAuth migrations (`getMigrations`/`runMigrations` from
 * `better-auth/db/migration`) so the `user`/`session`/`account`/`verification`
 * tables exist before serving auth traffic against a file-backed database.
 */
export function createAuth(database?: DatabaseSync): Auth {
  const db: DatabaseSync =
    database ?? new DatabaseSync(process.env.BETTER_AUTH_DB_PATH ?? ':memory:');

  // Type the options as `BetterAuthOptions` rather than letting the literal
  // widen to a narrow inferred object: better-auth's `betterAuth` is generic in
  // its options (`betterAuth<O>(options: O): Auth<O>`), so an untyped literal
  // would yield a specialized `Auth<{database; baseURL; …}>` that is NOT
  // assignable back to the broad `Auth` (= `Auth<BetterAuthOptions>`). Typing
  // `options` explicitly forces `betterAuth` to return `Auth<BetterAuthOptions>`.
  const options: BetterAuthOptions = {
    database: db,
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
    // better-auth signs session cookies with this; must be >= 32 chars.
    secret:
      process.env.BETTER_AUTH_SECRET ??
      'dev-better-auth-secret-replace-in-production',
    emailAndPassword: { enabled: true },
    // Rate limiting is disabled to avoid requiring its backing table in the
    // (not-yet-migrated) bootstrap database.
    rateLimit: { enabled: false },
    // Origins that may issue sign-in/sign-up POSTs without a CSRF failure.
    // The Vite dev server (5173) is always trusted so the local client can hit
    // the running server; additional origins come from BETTER_AUTH_TRUSTED_ORIGINS.
    trustedOrigins: [
      'http://localhost:5173',
      process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
        ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []),
    ],
    socialProviders: getSocialProviders(),
  };

  return betterAuth(options);
}

let _auth: Auth | null = null;

/**
 * Lazy singleton. The first call constructs an auth instance and later calls
 * reuse it; `setAuth(null)` forces re-creation. Construction is cheap and
 * side-effect-free (no DB queries) until a protected route is actually hit, so
 * this is safe to call from a per-request Express closure.
 */
export function getAuth(): Auth {
  if (!_auth) {
    _auth = createAuth();
  }
  return _auth;
}

/**
 * Replaces the singleton auth instance. Used by tests to swap in a migrated
 * `getTestInstance` auth so `requireAuth` validates against the same DB that
 * minted the session cookie.
 */
export function setAuth(auth: Auth | null): void {
  _auth = auth;
}

/**
 * Bootstraps the auth singleton AND runs BetterAuth's database migrations, so
 * the `user`/`session`/`account`/`verification` tables exist on the backing
 * `node:sqlite` database before the server starts serving `/api/auth/*`
 * traffic. Idempotent: the first call constructs the instance and migrates;
 * later calls return the cached singleton.
 *
 * Called once on server startup (`server/src/index.ts`); tests may invoke it
 * directly with `BETTER_AUTH_DB_PATH` pointed at a temp file.
 */
export async function initAuth(): Promise<Auth> {
  if (_auth) return _auth;
  const auth = createAuth();
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  _auth = auth;
  return auth;
}

export type { Auth };
