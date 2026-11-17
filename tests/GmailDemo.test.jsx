import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPage from '../src/pages/ChatPage';
import { DemoSettings } from '../src/components/account/DemoSettings';
import { fetchExchangeRate, getAiStatus } from '../src/chat/api';
import { entryStorage } from '../src/lib/storage';
import { planGmailImport } from '../src/gmail/import';
import {
  DEMO_QUEUE,
  demoFetchPending,
  disableDemo,
  enableDemo,
  isDemoMode,
  removeDemoEntries,
  simulateIncoming,
} from '../src/gmail/demo';
import { makeEntry } from './fixtures';

vi.mock('../src/chat/api', () => ({
  getAiStatus: vi.fn(),
  sendChat: vi.fn(),
  fetchExchangeRate: vi.fn(),
}));
beforeEach(async () => {
  localStorage.clear();
  await entryStorage.clear();
  getAiStatus.mockResolvedValue({
    cloud: [{ configured: true }],
    local: { configured: false },
  });
  fetchExchangeRate.mockResolvedValue({
    from: 'USD',
    to: 'SGD',
    rate: 1.3,
    date: '2026-11-17',
    checked_at: new Date().toISOString(),
  });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

it('starts with a batch that shows every outcome', () => {
  enableDemo();
  expect(isDemoMode()).toBe(true);
  const plan = planGmailImport(demoFetchPending().items, [], []);
  expect(plan.auto).toHaveLength(3);
  expect(plan.review).toHaveLength(2);
  expect(plan.skipped.notExpense).toBe(1);
  expect(plan.auto.every((entry) => entry.note.includes('demo data'))).toBe(true);
});

it('queues a new unique email each time one is simulated', () => {
  enableDemo();
  const first = simulateIncoming();
  const second = simulateIncoming();
  expect(first.id).not.toBe(second.id);
  expect(demoFetchPending().items).toHaveLength(8);
  expect(JSON.parse(localStorage.getItem(DEMO_QUEUE)).at(-1).id).toBe(second.id);
});

it('collects the demo emails in the chat, never touches fetch, and empties the queue', async () => {
  enableDemo();
  render(<ChatPage navigate={vi.fn()} />);
  expect(await screen.findByText(/Demo: Added 3 spends from Gmail/)).toBeInTheDocument();
  expect(
    await screen.findByText(/Demo: 2 Gmail transactions need a quick check/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Demo mode \(simulated emails\)/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  expect(await entryStorage.load()).toHaveLength(3);
  await waitFor(() => expect(demoFetchPending().items).toHaveLength(0));
});

it('removes only demo entries and leaves everything else', async () => {
  await entryStorage.save(makeEntry({ id: 'mine', merchant: 'My own' }));
  await entryStorage.save(
    makeEntry({ id: 'real', external_ref: 'gmail-18c3f0a1b2c3d4e5' }),
  );
  await entryStorage.save(makeEntry({ id: 'd1', external_ref: 'gmail-demoabc123' }));
  expect(await removeDemoEntries()).toBe(1);
  expect((await entryStorage.load()).map((entry) => entry.id).sort()).toEqual([
    'mine',
    'real',
  ]);
});

it('offers the demo from the Demo tab and exits it cleanly', async () => {
  const user = userEvent.setup();
  render(<DemoSettings />);
  await user.click(screen.getByRole('button', { name: 'Try the demo' }));
  expect(screen.getByRole('heading', { name: 'Gmail demo mode' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Simulate email' }));
  expect(await screen.findByText(/Simulated an email from/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Remove demo entries' }));
  await user.click(screen.getByRole('button', { name: /Confirm: remove demo entries/ }));
  expect(await screen.findByText(/Removed 0 demo entries/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Exit demo mode' }));
  expect(isDemoMode()).toBe(false);
  disableDemo();
});
