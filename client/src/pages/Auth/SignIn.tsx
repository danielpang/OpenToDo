import { authClient } from '../../lib/auth-client';

/**
 * Provider keys understood by BetterAuth's social provider map. This mirrors
 * the `socialProviders` configured on the server (see `server/src/auth.ts`):
 * Google, plus X.com wired through BetterAuth's `twitter` provider key since
 * BetterAuth 1.7.x names the X.com OAuth integration `twitter`.
 */
type SocialProvider = 'google' | 'twitter';

/**
 * Unauthenticated landing for `/sign-in`. Presents the two SSO entry points —
 * Google and X — each of which calls
 * `authClient.signIn.social({ provider, callbackURL })` with `callbackURL` set
 * to `window.location.origin` so BetterAuth redirects the browser back to the
 * Vite app (the user's origin) after the provider handshake, rather than the
 * API host, then routes through `/api/auth/callback/...` before completing
 * the session.
 */
export default function SignIn() {
  async function signIn(provider: SocialProvider) {
    await authClient.signIn.social({ provider, callbackURL: window.location.origin });
  }

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-4">
      <h1 className="text-2xl font-semibold">Sign in to OpenToDo</h1>

      <button
        type="button"
        onClick={() => signIn('google')}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary/90"
      >
        Sign in with Google
      </button>

      <button
        type="button"
        onClick={() => signIn('twitter')}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
      >
        Sign in with X
      </button>
    </section>
  );
}
