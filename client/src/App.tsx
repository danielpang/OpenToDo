import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';

const BoardsPage = lazy(() => import('./pages/BoardsPage'));
const BoardView = lazy(() => import('./pages/BoardView'));

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
          <Routes>
            <Route index element={<Navigate to="/boards" replace />} />
            <Route path="/boards" element={<BoardsPage />} />
            <Route path="/boards/:id" element={<BoardView />} />
            <Route path="*" element={<Navigate to="/boards" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
