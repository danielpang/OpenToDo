import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import RequireAuth from './RequireAuth';
import { authClient } from '../lib/auth-client';

// Mock the auth client at the module boundary. The auth client is built from
// `better-auth/react`'s `createAuthClient`; in unit tests we never want to touch
// the network or require an absolute baseURL, so we swap the whole module. The
// factory uses `vi.fn()` (matching the rest of the test suite); `vi.mocked`
// below re-attaches the real hook signatures for type-safe `.mock*` helpers.
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

/** Real return shape of `authClient.useSession`, captured for type-safe fixtures. */
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

/**
 * Build a full `useSession` return value. Constructing the object through this
 * helper (rather than inline literals) keeps every fixture structurally
 * complete so `mockReturnValue` type-checks against the react client's return
 * shape.
 */
function sessionReturn(data: UseSessionReturn['data'], opts: { isPending?: boolean } = {}): UseSessionReturn {
  return {
    data,
    isPending: opts.isPending ?? false,
    isRefetching: false,
    error: null,
    refetch: vi.fn(),
  };
}

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to an unauthenticated, non-pending session so a render never
    // destructures `undefined`. Per-test overrides re-call `mockReturnValue`.
    useSession.mockReturnValue(sessionReturn(null));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders a loading fallback while the session is pending', () => {
    useSession.mockReturnValue(sessionReturn(null, { isPending: true }));

    render(
      <MemoryRouter initialEntries={['/boards']}>
        <Routes>
          <Route path="/boards" element={<RequireAuth><p>Protected Content</p></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/loading/i)).toBeTruthy();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('redirects to /sign-in when there is no session', async () => {
    useSession.mockReturnValue(sessionReturn(null));

    render(
      <MemoryRouter initialEntries={['/boards']}>
        <Routes>
          <Route path="/sign-in" element={<p>Sign In Page</p>} />
          <Route path="/boards" element={<RequireAuth><p>Protected Content</p></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sign In Page')).toBeTruthy();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('renders the protected content once a session exists', () => {
    useSession.mockReturnValue(sessionReturn({ user, session }));

    render(
      <MemoryRouter initialEntries={['/boards']}>
        <Routes>
          <Route path="/boards" element={<RequireAuth><p>Protected Content</p></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected Content')).toBeTruthy();
  });

  it('stashes the originally-requested path in the redirect router state', () => {
    useSession.mockReturnValue(sessionReturn(null));

    function SignInState() {
      const { state } = useLocation();
      return <p>from: {(state as { from?: string } | null)?.from ?? 'none'}</p>;
    }

    render(
      <MemoryRouter initialEntries={['/boards']}>
        <Routes>
          <Route path="/sign-in" element={<SignInState />} />
          <Route path="/boards" element={<RequireAuth><p>Protected Content</p></RequireAuth>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('from: /boards')).toBeTruthy();
  });
});
