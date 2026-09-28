import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BoardsPage from './pages/BoardsPage';

describe('client scaffold', () => {
  it('renders the boards page stub', () => {
    render(<BoardsPage />);
    expect(screen.getByRole('heading', { name: /boards/i })).toBeTruthy();
  });
});
