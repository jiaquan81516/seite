import { beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPage from '../src/pages/ChatPage';
import { getAiStatus, sendChat } from '../src/chat/api';
import { entryStorage } from '../src/lib/storage';
import { loadConversation } from '../src/chat/storage';
import { makeEntry } from './fixtures';
import { aiReply } from './ai-fixtures';
vi.mock('../src/chat/api', () => ({
  getAiStatus: vi.fn(),
  sendChat: vi.fn(),
  fetchExchangeRate: vi.fn(),
}));
beforeEach(async () => {
  await entryStorage.clear();
  getAiStatus.mockResolvedValue({
    cloud: [{ configured: true }],
    local: { configured: false },
  });
});
async function start() {
  const user = userEvent.setup();
  render(<ChatPage navigate={vi.fn()} onViewEntries={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Ask or add a spend' });
  return user;
}
async function ask(user, text) {
  await user.type(screen.getByLabelText('Ask Seite or send a receipt'), text);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Send ↗' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Send ↗' }));
  await screen.findByRole('region', { name: 'Entry action' });
}
it('previews the newest saved log, removes it only on confirmation, and supports Undo offline', async () => {
  const recent = makeEntry({
    id: 'new',
    date: '2026-06-19',
    merchant: '531 Upper Cross',
    amount_cents: 1170,
    created_at: '2026-11-17T08:00:00Z',
  });
  await entryStorage.save(makeEntry());
  await entryStorage.save(recent);
  getAiStatus.mockRejectedValue(new Error('Offline'));
  const user = await start();
  await ask(user, 'remove the recently added log');
  expect(screen.getByText('531 Upper Cross')).toBeInTheDocument();
  expect(await entryStorage.load()).toHaveLength(2);
  expect(sendChat).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Remove entry' }));
  await screen.findByText('Your tracker has been updated.');
  expect((await entryStorage.load()).map((entry) => entry.id)).toEqual(['cafe']);
  expect(
    await screen.findByText('Removed 531 Upper Cross (S$11.70) from your tracker.'),
  ).toBeInTheDocument();
  expect((await loadConversation()).at(-1).role).toBe('assistant');
  cleanup();
  render(<ChatPage navigate={vi.fn()} onViewEntries={vi.fn()} />);
  await screen.findByRole('button', { name: 'Undo' });
  expect(
    screen.getAllByText('Removed 531 Upper Cross (S$11.70) from your tracker.'),
  ).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  await screen.findByText('Undone. Your original entry is back.');
  expect(await entryStorage.load()).toContainEqual(recent);
  expect(
    await screen.findByText(
      'Undone. Restored 531 Upper Cross (S$11.70) in your tracker.',
    ),
  ).toBeInTheDocument();
});
it('cancels a proposed removal without changing saved spending', async () => {
  await entryStorage.save(makeEntry());
  const user = await start();
  await ask(user, 'delete my last entry');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await screen.findByText('Cancelled. Your tracker was not changed.');
  expect(await entryStorage.load()).toHaveLength(1);
  expect((await loadConversation()).at(-1).action.status).toBe('cancelled');
});
it('shows model-proposed field changes and applies exactly those changes', async () => {
  const original = makeEntry();
  await entryStorage.save(original);
  sendChat.mockResolvedValue({
    ...aiReply({
      kind: 'action',
      reply: 'Review these changes.',
      transactions: [],
      action: {
        type: 'update',
        target_id: original.id,
        changes: {
          merchant: null,
          amount_cents: 1170,
          date: null,
          time: null,
          category: null,
          method: 'Cash',
          note: null,
        },
      },
    }),
    provider: 'gemini',
    model: 'test',
  });
  const user = await start();
  await ask(user, 'Change Test cafe to $11.70 and Cash');
  expect(screen.getByText('Amount (SGD)')).toBeInTheDocument();
  expect(screen.getByText('S$11.70')).toBeInTheDocument();
  expect((await entryStorage.load())[0].amount_cents).toBe(920);
  await user.click(screen.getByRole('button', { name: 'Apply changes' }));
  await screen.findByText('Your tracker has been updated.');
  expect(
    await screen.findByText('Updated Test cafe (S$11.70) in your tracker.'),
  ).toBeInTheDocument();
  expect((await entryStorage.load())[0]).toMatchObject({
    id: original.id,
    merchant: original.merchant,
    amount_cents: 1170,
    method: 'Cash',
    created_at: original.created_at,
  });
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  await screen.findByText('Undone. Your original entry is back.');
  expect(await entryStorage.load()).toEqual([original]);
});
it('asks which log to remove when a batch was saved at the same time', async () => {
  await entryStorage.save(makeEntry());
  await entryStorage.save(makeEntry({ id: 'ride', merchant: 'Ride' }));
  const user = await start();
  await ask(user, 'remove the recently added log');
  expect(screen.getByRole('button', { name: 'Remove entry' })).toBeDisabled();
  await user.click(screen.getByLabelText('Which entry did you mean?'));
  await user.click(screen.getByRole('option', { name: /Ride/ }));
  await user.click(screen.getByRole('button', { name: 'Remove entry' }));
  await screen.findByText('Your tracker has been updated.');
  expect((await entryStorage.load()).map((entry) => entry.id)).toEqual(['cafe']);
});
it('rejects a stale preview and preserves a newer edit from another tab', async () => {
  const original = makeEntry();
  await entryStorage.save(original);
  const user = await start();
  await ask(user, 'remove the recently added log');
  await entryStorage.save({ ...original, amount_cents: 999 });
  await user.click(screen.getByRole('button', { name: 'Remove entry' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('has changed');
  expect((await entryStorage.load())[0].amount_cents).toBe(999);
  expect((await loadConversation()).some((message) => message.completionKey)).toBe(false);
});
