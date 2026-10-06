import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import PlannerPage from './PlannerPage';

function renderPage(ui: ReactElement = <PlannerPage />) {
  render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('PlannerPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('always shows the sample-data banner', () => {
    renderPage();

    expect(
      screen.getByText(
        /forecasts for toronto, montreal and vancouver are illustrative placeholders/i,
      ),
    ).toBeTruthy();
  });

  it('names Vancouver in the hero with score 90 and selects it via View forecast', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { name: /head to vancouver this weekend/i })).toBeTruthy();
    expect(screen.getAllByText('90').length).toBeGreaterThan(0);
    expect(screen.getByText(/\/100 clear-weekend score/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /toronto/i }));
    expect(screen.getByRole('button', { name: /toronto/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    await user.click(screen.getByRole('button', { name: /view forecast/i }));
    expect(screen.getByRole('button', { name: /vancouver/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('selects the recommended destination on first load', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /vancouver/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /toronto/i }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: /montreal/i }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('updates the forecast, clearest-day tag, and packing list when Toronto is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText(/three-day forecast — vancouver/i)).toBeTruthy();
    expect(screen.getByText('Clearest day').closest('[aria-live]')?.textContent).toMatch(/Sat/);

    await user.click(screen.getByRole('button', { name: /toronto/i }));

    expect(screen.getByText(/three-day forecast — toronto/i)).toBeTruthy();
    const live = screen.getByText(/three-day forecast — toronto/i).closest('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live?.textContent).toMatch(/Partly cloudy/);
    expect(live?.textContent).toMatch(/Light rain/);
    expect(live?.textContent).toMatch(/Cloudy/);
    expect(live?.textContent).toMatch(/Rain 20%/);
    expect(screen.getByText('Clearest day').closest('article')?.textContent).toMatch(/Fri/);
    expect(screen.getByText(/tuned for a toronto weekend/i)).toBeTruthy();
    expect(screen.getByText(/60% chance of rain saturday/i)).toBeTruthy();
  });

  it('toggles a packing item and applies a struck-through style', async () => {
    const user = userEvent.setup();
    renderPage();

    const checkbox = screen.getByRole('checkbox', { name: /light rain jacket/i });
    const row = checkbox.closest('label');
    expect(checkbox).toBeTruthy();
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(row?.className).not.toMatch(/line-through/);

    await user.click(screen.getByText('Light rain jacket'));
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    expect(row?.className).toMatch(/line-through/);

    await user.click(screen.getByText('Light rain jacket'));
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(row?.className).not.toMatch(/line-through/);
  });

  it('renders an empty state when there are no destinations', () => {
    renderPage(<PlannerPage destinations={[]} />);

    expect(screen.getByText(/no destinations to compare yet/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /head to/i })).toBeNull();
  });
});
