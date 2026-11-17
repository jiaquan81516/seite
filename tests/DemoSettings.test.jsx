import { beforeEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoSettings } from '../src/components/account/DemoSettings';
import { ACCOUNT_SECTIONS } from '../src/account/navigation';
import EntryListHarness from './helpers/entry-list-harness';
import { DEMO_ENTRIES, isAutoSeedOn, seedDemoData } from '../src/lib/demo-data';
import { getPrototype } from '../src/lib/prototype';
import { entryStorage } from '../src/lib/storage';
import { makeEntry } from './fixtures';

beforeEach(async () => {
  localStorage.clear();
  await entryStorage.clear();
});

it('has a Demo tab in the profile menu sections', () => {
  expect(ACCOUNT_SECTIONS.some((section) => section.id === 'demo')).toBe(true);
});

it('switches between Prototype A and B and remembers the choice', async () => {
  const user = userEvent.setup();
  render(<DemoSettings />);
  const toggle = screen.getByRole('switch', { name: 'Use Prototype B' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(getPrototype()).toBe('A');
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(getPrototype()).toBe('B');
  expect(screen.getByText(/grouped by day/)).toBeInTheDocument();
  await user.click(toggle);
  expect(getPrototype()).toBe('A');
});

it('reloads and removes only the sample entries', async () => {
  const user = userEvent.setup();
  await entryStorage.save(makeEntry({ id: 'mine' }));
  render(<DemoSettings />);
  await user.click(screen.getByRole('button', { name: 'Reload sample data' }));
  expect(await screen.findByText(/Added 147 sample entries/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove sample data' }));
  await user.click(
    await screen.findByRole('button', { name: /Confirm: remove sample data/ }),
  );
  expect(await screen.findByText(/Removed 147 sample entries/)).toBeInTheDocument();
  expect((await entryStorage.load()).map((entry) => entry.id)).toEqual(['mine']);
});

it('can turn off adding sample data on sign-in', async () => {
  const user = userEvent.setup();
  render(<DemoSettings />);
  expect(isAutoSeedOn()).toBe(true);
  await user.click(screen.getByRole('switch', { name: 'Add sample data on sign-in' }));
  expect(isAutoSeedOn()).toBe(false);
});

it('groups entries by day with daily totals in Prototype B only', async () => {
  const entries = [
    makeEntry({ id: 'a', date: '2026-11-05', amount_cents: 1000 }),
    makeEntry({ id: 'b', date: '2026-11-05', amount_cents: 250 }),
    makeEntry({ id: 'c', date: '2026-11-04', amount_cents: 500 }),
  ];
  const { rerender } = render(<EntryListHarness entries={entries} grouped />);
  expect(screen.getByText('S$12.50')).toBeInTheDocument();
  expect(
    screen.getByText('S$5.00', { selector: '.day-group-head span' }),
  ).toBeInTheDocument();
  rerender(<EntryListHarness entries={entries} />);
  expect(document.querySelector('.day-group-head')).toBeNull();
});

it('keeps the sample data constant ready to seed', async () => {
  expect(DEMO_ENTRIES.length).toBe(147);
  expect(await seedDemoData()).toBe(147);
});
