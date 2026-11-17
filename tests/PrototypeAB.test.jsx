import { AccountProvider } from '../src/account/AccountProvider';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrackerPage from '../src/pages/TrackerPage';
import { InsightView, insightStats } from '../src/components/InsightView';
import { entryStorage } from '../src/lib/storage';
import { getPrototype } from '../src/lib/prototype';
import { shiftDays, today } from '../src/lib/dates';
import { dayContext } from '../src/components/DayContext';
import { makeEntry } from './fixtures';

vi.mock('../src/lib/storage', () => ({
  entryStorage: { load: vi.fn(), save: vi.fn(), remove: vi.fn() },
}));

const entries = [
  makeEntry({ id: 'a', category: 'Food & Drink', amount_cents: 3000 }),
  makeEntry({ id: 'b', category: 'Food & Drink', amount_cents: 1000 }),
  makeEntry({ id: 'c', category: 'Transport', amount_cents: 1000 }),
];
const filters = {
  date: '2026-11-17',
  period: 'Day',
  category: '',
  method: '',
  search: '',
  day: '',
};

beforeEach(() => {
  localStorage.clear();
  entryStorage.load.mockResolvedValue(entries);
});

describe('insight stats', () => {
  it('totals, averages and ranks categories', () => {
    const stats = insightStats(entries, { ...filters, period: 'Week' });
    expect(stats.total).toBe(5000);
    expect(stats.ranked.map((group) => group.category)).toEqual([
      'Food & Drink',
      'Transport',
    ]);
  });
});

describe('Prototype B insight view', () => {
  it('shows headline numbers and filters from a ranked bar', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <InsightView
        entries={entries}
        allEntries={entries}
        filters={filters}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('S$50.00')).toBeInTheDocument();
    expect(screen.getByText('80% of spending')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Filter Transport/ }));
    expect(onSelect).toHaveBeenCalledWith('Transport');
  });
});

describe('Prototype switch on the tracker', () => {
  it('swaps the donut layout for the insight layout and remembers it', async () => {
    const user = userEvent.setup();
    render(
      <AccountProvider>
        <TrackerPage />
      </AccountProvider>,
    );
    await screen.findByRole('heading', { name: 'Your money, at a glance.' });
    expect(screen.getByRole('button', { name: 'Prototype A' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('region', { name: 'Spending total' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prototype B' }));
    expect(screen.getByRole('region', { name: 'Spending insights' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Spending total' })).toBeNull();
    expect(screen.getByText('Biggest category')).toBeInTheDocument();
    expect(getPrototype()).toBe('B');
    await user.click(screen.getByRole('button', { name: 'Prototype A' }));
    expect(screen.getByRole('region', { name: 'Spending total' })).toBeInTheDocument();
  });
});

describe('Day view context', () => {
  it('compares the day with the week before instead of showing a single bar', async () => {
    const user = userEvent.setup();
    const day = (offset) => shiftDays(today(), offset);
    entryStorage.load.mockResolvedValue([
      makeEntry({ id: 'p1', date: day(-3), amount_cents: 1000 }),
      makeEntry({ id: 'p2', date: day(-5), amount_cents: 1000 }),
      makeEntry({ id: 'x', date: today(), merchant: 'Mala Hotpot', amount_cents: 4000 }),
    ]);
    render(
      <AccountProvider>
        <TrackerPage />
      </AccountProvider>,
    );
    await screen.findByRole('heading', { name: 'Your money, at a glance.' });
    expect(screen.queryByText('Day by day')).toBeNull();
    expect(screen.getByText('Compared with your week')).toBeInTheDocument();
    expect(screen.getByText('S$37.14 more than your usual day')).toBeInTheDocument();
    expect(screen.getByText('Mala Hotpot', { selector: 'strong' })).toBeInTheDocument();
    const [bar] = screen.getAllByRole('button', { name: /S\$10\.00$/ });
    await user.click(bar);
    expect(
      screen.getByRole('button', { name: /S\$10\.00$/, pressed: true }),
    ).toBeInTheDocument();
  });
  it('summarises a quiet day, a busy day and no history', () => {
    const spend = (date, cents, id) => makeEntry({ id, date, amount_cents: cents });
    const base = Array.from({ length: 7 }, (_, index) =>
      spend(shiftDays('2026-11-17', -7 + index), 1000, `b${index}`),
    );
    expect(
      dayContext([...base, spend('2026-11-17', 1000, 'a')], '2026-11-17').verdict,
    ).toBe('same');
    expect(
      dayContext([...base, spend('2026-11-17', 300, 'a')], '2026-11-17').verdict,
    ).toBe('below');
    expect(
      dayContext([...base, spend('2026-11-17', 5000, 'a')], '2026-11-17').verdict,
    ).toBe('above');
    expect(dayContext([], '2026-11-17').verdict).toBe('none');
  });
});

describe('Prototype B has two visuals like Prototype A', () => {
  it('shows ranked categories beside the week comparison on Day, and day bars on Week', async () => {
    const user = userEvent.setup();
    localStorage.setItem('seite-prototype', 'B');
    render(
      <AccountProvider>
        <TrackerPage />
      </AccountProvider>,
    );
    await screen.findByRole('heading', { name: 'Your money, at a glance.' });
    expect(screen.getByText('Where it went')).toBeInTheDocument();
    expect(screen.getByText('Compared with your week')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByText('Where it went')).toBeInTheDocument();
    expect(screen.getByText('Day by day')).toBeInTheDocument();
  });
});
