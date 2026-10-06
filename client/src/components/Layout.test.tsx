import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import Layout from './Layout';
import { authClient } from '../lib/auth-client';

vi.mock('../lib/auth-client', () => ({
  __esModule: true,
  authClient: {
    useSession: vi.fn(),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
  default: {
    useSession: vi.fn(),
    signIn: { social: vi.fn() },
    signOut: vi.fn(),
  },
}));

const useSession = vi.mocked(authClient.useSession);

type UseSessionReturn = ReturnType<typeof authClient.useSession>;

const user = {
  id: 'u_123',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
  email: 'ada@example.com',
  emailVerified: true,
  name: 'Ada Lovelace',
  image: null,
};

const session = {
  id: 's_456',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
  userId: 'u_123',
  expiresAt: new Date('2099-01-01T00:00:00Z'),
  token: 'tok_abc',
};

function sessionReturn(
  data: UseSessionReturn['data'],
  opts: { isPending?: boolean } = {},
): UseSessionReturn {
  return {
    data,
    isPending: opts.isPending ?? false,
    isRefetching: false,
    error: null,
    refetch: vi.fn(),
  };
}

function renderLayout(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/boards" element={<p>Boards page</p>} />
          <Route path="/planner" element={<p>Planner page</p>} />
          <Route path="/sign-in" element={<p>Sign in page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.mockReturnValue(sessionReturn(null));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hides the primary nav when there is no session', () => {
    renderLayout('/sign-in');

    expect(screen.queryByRole('navigation', { name: /primary/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /weekend planner/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^boards$/i })).toBeNull();
  });

  it('shows Boards and Weekend planner links when signed in', () => {
    useSession.mockReturnValue(sessionReturn({ user, session }));

    renderLayout('/boards');

    expect(screen.getByRole('navigation', { name: /primary/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Boards' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Weekend planner' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Boards' }).getAttribute('aria-current')).toBe('page');
    expect(
      screen.getByRole('link', { name: 'Weekend planner' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('marks Weekend planner as the current page on /planner', () => {
    useSession.mockReturnValue(sessionReturn({ user, session }));

    renderLayout('/planner');

    expect(screen.getByRole('link', { name: 'Weekend planner' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.getByRole('link', { name: 'Boards' }).getAttribute('aria-current')).toBeNull();
  });
});
