import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';

// Lazy page shells. The actual board/list/card data will be wired in by L3
// (BoardsPage) and L4 (BoardView); for F1 these are harmless placeholders that
// resolve to a static heading so the route shell is exercised end-to-end.
const BoardsPage = lazy(() => import('./pages/BoardsPage'));
const BoardView = lazy(() => import('./pages/BoardView'));
// Auth surfaces are lazy too: the sign-in shell is only fetched when an
// unauthenticated (or explicitly navigating) user reaches `/sign-in`.
const SignIn = lazy(() => import('./pages/Auth/SignIn'));

/**
 * Router shell. `Layout` is a path-less *layout route*: its `<Outlet/>` renders
 * the matched child route while the header stays put. Every page route is
 * lazy-loaded and wrapped in a single `<Suspense>` boundary so the shell is
 * ready while chunks stream in.
 *
 * The `/boards*` routes are wrapped in `RequireAuth`, so an unauthenticated
 * session is redirected to `/sign-in`. `/sign-in` lives outside the guard so
 * the login shell is always reachable.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/boards" replace />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route
              path="/boards"
              element={
                <RequireAuth>
                  <BoardsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/boards/:id"
              element={
                <RequireAuth>
                  <BoardView />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/boards" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
