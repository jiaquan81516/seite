import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPage from '../src/pages/ChatPage';
import { fetchExchangeRate, getAiStatus } from '../src/chat/api';
import { entryStorage } from '../src/lib/storage';
import { loadConversation } from '../src/chat/storage';
import { saveGmailSettings } from '../src/gmail/settings';

vi.mock('../src/chat/api', () => ({
  getAiStatus: vi.fn(),
  sendChat: vi.fn(),
  fetchExchangeRate: vi.fn(),
}));
const settings = {
  url: 'https://script.google.com/macros/s/AKfycbxExample_123/exec',
  key: 'k'.repeat(24),
};
const item = (id, overrides = {}) => ({
  id,
  merchant: 'Grab',
  amount: 12.5,
  currency: 'SGD',
  date: '2026-11-17',
  time: '18:30',
  payment_method: 'PayLah',
  category: 'Transport',
  kind: 'expense',
  confidence: 0.95,
  received_at: '2026-11-17T10:31:00.000Z',
  ...overrides,
});
let queue;
let acked;
beforeEach(async () => {
  localStorage.clear();
  await entryStorage.clear();
  acked = [];
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
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      if (init?.method === 'POST') {
        acked.push(...JSON.parse(init.body).ids);
        return { json: async () => ({ ok: true }) };
      }
      return {
        json: async () => ({
          ok: true,
          items: queue,
          remaining: 0,
          last_sync: new Date().toISOString(),
        }),
      };
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

it('saves clear emails, queues unclear ones for review, skips refunds, and acknowledges all', async () => {
  saveGmailSettings(settings);
  queue = [
    item('clear0000001'),
    item('foreign00001', { currency: 'USD', merchant: 'Steam' }),
    item('refund000001', { kind: 'refund' }),
  ];
  render(<ChatPage navigate={vi.fn()} />);
  expect(await screen.findByText(/Added 1 spend from Gmail: Grab/)).toBeInTheDocument();
  expect(
    await screen.findByText(/1 Gmail transaction needs a quick check/),
  ).toBeInTheDocument();
  const saved = await entryStorage.load();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    id: 'gmail-clear0000001',
    source: 'gmail_import',
    amount_cents: 1250,
  });
  await waitFor(() =>
    expect(acked.sort()).toEqual(['clear0000001', 'foreign00001', 'refund000001']),
  );
  const history = await loadConversation();
  expect(
    history.some((message) => message.candidates?.[0]?.gmailId === 'foreign00001'),
  ).toBe(true);
  expect(screen.getByText(/Gmail checked at/)).toBeInTheDocument();
});

it('does not add the same email twice when the script offers it again', async () => {
  saveGmailSettings(settings);
  queue = [item('clear0000001')];
  const user = userEvent.setup();
  render(<ChatPage navigate={vi.fn()} />);
  await screen.findByText(/Added 1 spend from Gmail/);
  await user.click(screen.getByRole('button', { name: 'Check now' }));
  await waitFor(() =>
    expect(fetch.mock.calls.filter(([, init]) => !init?.method).length).toBeGreaterThan(
      1,
    ),
  );
  expect(await entryStorage.load()).toHaveLength(1);
  expect(screen.getAllByText(/Added 1 spend from Gmail/)).toHaveLength(1);
});

it('keeps emails queued and says so when the script cannot be reached', async () => {
  saveGmailSettings(settings);
  fetch.mockRejectedValue(new TypeError('Failed to fetch'));
  render(<ChatPage navigate={vi.fn()} />);
  expect(await screen.findByText(/Couldn’t reach your Gmail script/)).toBeInTheDocument();
  expect(await entryStorage.load()).toHaveLength(0);
  expect(acked).toEqual([]);
});

it('does nothing and shows no Gmail line when Gmail is not connected', async () => {
  render(<ChatPage navigate={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Ask or add a spend' });
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByText(/Gmail checked/)).not.toBeInTheDocument();
});
