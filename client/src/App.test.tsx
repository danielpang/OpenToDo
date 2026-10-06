import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import App from './App';
import { authClient } from './lib/auth-client';

vi.mock('./lib/auth-client', () => ({
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

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  render(<App />);
}

describe('App planner route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.mockReturnValue(sessionReturn(null));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('redirects an unauthenticated /planner visit to /sign-in', async () => {
    renderAt('/planner');

    expect(await screen.findByRole('heading', { name: /sign in to opentodo/i })).toBeTruthy();
    expect(screen.queryByText(/sample data/i)).toBeNull();
  });

  it('renders the planner for an authenticated /planner visit', async () => {
    useSession.mockReturnValue(sessionReturn({ user, session }));

    renderAt('/planner');

    expect(await screen.findByText(/sample data/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /head to vancouver this weekend/i })).toBeTruthy();
  });
});
