import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { motion, theme } from '../theme';
import { authClient } from '../lib/auth-client';

/**
 * Application shell. Renders the persistent header — a branded accent bar with
 * the "OpenToDo" title that slides down on mount via the `motion.spring` token
 * (transform + opacity) — and an `<Outlet/>` into which React Router renders
 * the matched page route (BoardsPage, BoardView, or PlannerPage).
 *
 * The header also carries the auth affordance: when a session is present it
 * shows the signed-in user's name (and a sign-out button that calls
 * `authClient.signOut()`); when there is no session it stays quiet so the
 * `/sign-in` shell can own the header.
 *
 * The shell is intentionally free of page data concerns: L3/L4 own the page
 * components; this layout only provides structure, theming, the motion
 * entrance, and the auth control. It is a layout route element (see
 * App.tsx), so callers do not pass `children`.
 */
export default function Layout() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(true), []);

  const { data: session } = authClient.useSession();
  const user = session?.user;

  const springTiming = `${motion.spring.duration} ${motion.spring.easing}`;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header
        className="flex items-center justify-between gap-3 px-4 py-3 shadow"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(-0.75rem)',
          opacity: visible ? 1 : 0,
          transition: `transform ${springTiming}, opacity ${springTiming}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="h-6 w-2 rounded"
            style={{ backgroundColor: theme.colors.accent }}
            aria-hidden="true"
          />
          <h1 className="text-lg font-semibold">OpenToDo</h1>
        </div>

        {user && (
          <nav aria-label="Primary" className="flex items-center gap-4">
            <NavLink
              to="/boards"
              className={({ isActive }) =>
                isActive
                  ? 'rounded-sm text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                  : 'rounded-sm text-sm font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-400 dark:hover:text-slate-100'
              }
            >
              Boards
            </NavLink>
            <NavLink
              to="/planner"
              className={({ isActive }) =>
                isActive
                  ? 'rounded-sm text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                  : 'rounded-sm text-sm font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-400 dark:hover:text-slate-100'
              }
            >
              Weekend planner
            </NavLink>
          </nav>
        )}

        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm" aria-label="signed in">
              {user.name || user.email}
            </span>
            <button
              type="button"
              onClick={() => authClient.signOut()}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
