import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SignIn from './SignIn';
import { authClient } from '../../lib/auth-client';

// Mock the auth client so the buttons exercise the typed `signIn.social`
// surface without a network or a real BetterAuth instance. The factory mirrors
// the module's shape (named + default); `vi.mocked` reattaches the real method
// signature for type-safe call assertions.
vi.mock('../../lib/auth-client', () => ({
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

const social = vi.mocked(authClient.signIn.social);

describe('SignIn', () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('signs in with Google when the Google button is clicked', async () => {
    const user = userEvent.setup();
    social.mockResolvedValue(undefined);

    render(<SignIn />);

    await user.click(screen.getByRole('button', { name: /sign in with google/i }));

    expect(social).toHaveBeenCalledTimes(1);
    expect(social).toHaveBeenCalledWith({ provider: 'google' });
  });

  it('signs in with X (twitter provider) when the X button is clicked', async () => {
    const user = userEvent.setup();
    social.mockResolvedValue(undefined);

    render(<SignIn />);

    await user.click(screen.getByRole('button', { name: /sign in with x/i }));

    expect(social).toHaveBeenCalledTimes(1);
    expect(social).toHaveBeenCalledWith({ provider: 'twitter' });
  });

  it('routes each provider through signIn.social with the correct key', async () => {
    const user = userEvent.setup();
    social.mockResolvedValue(undefined);

    render(<SignIn />);

    await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    await user.click(screen.getByRole('button', { name: /sign in with x/i }));

    expect(social).toHaveBeenCalledTimes(2);
    const providers = social.mock.calls.map((c) => (c[0] as { provider: string }).provider);
    expect(providers).toEqual(['google', 'twitter']);
  });
});
