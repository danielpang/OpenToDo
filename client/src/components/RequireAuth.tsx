import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { authClient } from '../lib/auth-client';

export interface RequireAuthProps {
  /** Protected content, rendered once a session is confirmed. */
  children: ReactNode;
}

/**
 * Route guard for the authenticated shell.
 *
 * Renders `children` once the BetterAuth client resolves a session. While the
 * session is being fetched (`useSession` is pending) it renders a lightweight
 * fallback so unauthenticated content is never flashed. When there is no session
 * it redirects to `/sign-in`, stashing the originally-requested path in router
 * state so the sign-in flow can return the user there afterwards.
 *
 * Wraps the `/boards*` routes declared in `App.tsx`.
 */
export default function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (!session) {
    return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
