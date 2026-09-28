import { useEffect, useState, type ReactNode } from 'react';
import { motion, theme } from '../theme';

export default function Layout({ children }: { children?: ReactNode }) {
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
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
