import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion, theme } from '../theme';

/**
 * Application shell. Renders the persistent header — a branded accent bar with
 * the "OpenToDo" title that slides down on mount via the `motion.spring` token
 * (transform + opacity) — and an `<Outlet/>` into which React Router renders
 * the matched page route (BoardsPage or BoardView).
 *
 * The shell is intentionally free of page data concerns: L3/L4 own the page
 * components; this layout only provides structure, theming, and the motion
 * entrance. It is a layout route element (see App.tsx), so callers do not pass
 * `children`.
 */
export default function Layout() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(true), []);

  const springTiming = `${motion.spring.duration} ${motion.spring.easing}`;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header
        className="flex items-center gap-3 px-4 py-3 shadow"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(-0.75rem)',
          opacity: visible ? 1 : 0,
          transition: `transform ${springTiming}, opacity ${springTiming}`,
        }}
      >
        <span
          className="h-6 w-2 rounded"
          style={{ backgroundColor: theme.colors.accent }}
          aria-hidden="true"
        />
        <h1 className="text-lg font-semibold">OpenToDo</h1>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
