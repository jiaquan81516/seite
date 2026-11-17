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
function proposeBulk(filter) {
  sendChat.mockResolvedValue({
    ...aiReply({
      kind: 'action',
      reply: 'Review the matching entries.',
      transactions: [],
      action: {
        type: 'bulk_delete',
        target_id: null,
        changes: null,
        filter: {
          category: null,
          method: null,
          merchant: null,
          date_from: null,
          date_to: null,
          ...filter,
        },
      },
    }),
    provider: 'gemini',
    model: 'test',
  });
}
async function ask(text) {
  const user = userEvent.setup();
  render(<ChatPage navigate={vi.fn()} onViewEntries={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Ask or add a spend' });
  await user.type(screen.getByLabelText('Ask Seite or send a receipt'), text);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Send ↗' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Send ↗' }));
  await screen.findByRole('region', { name: 'Bulk removal' });
  return user;
}
const grab = (id, cents = 1000) =>
  makeEntry({ id, merchant: `Grab ${id}`, category: 'Transport', amount_cents: cents });

it('lists matches with a total, removes only ticked entries, and undoes them together', async () => {
  for (const entry of [grab('a', 1000), grab('b', 2000), grab('c', 500)])
    await entryStorage.save(entry);
  await entryStorage.save(makeEntry({ id: 'keep', merchant: 'NTUC' }));
  proposeBulk({ category: 'Transport' });
  const user = await ask('delete all my transport spending');
  expect(screen.getByText('3 of 3 selected · S$35.00')).toBeInTheDocument();
  expect(await entryStorage.load()).toHaveLength(4);
  await user.click(screen.getByRole('checkbox', { name: /Grab c/ }));
  expect(screen.getByText('2 of 3 selected · S$30.00')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^Remove 2 entries/ }));
  await screen.findByText(/Removed\. You can undo/);
  expect((await entryStorage.load()).map((entry) => entry.id).sort()).toEqual([
    'c',
    'keep',
  ]);
  cleanup();
  render(<ChatPage navigate={vi.fn()} onViewEntries={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Undo' }));
  await screen.findByText('Undone. The entries are back in your tracker.');
  expect(await entryStorage.load()).toHaveLength(4);
});

it('cannot remove with nothing ticked and cancelling changes nothing', async () => {
  await entryStorage.save(grab('a'));
  proposeBulk({ merchant: 'grab' });
  const user = await ask('delete grab');
  await user.click(screen.getByRole('button', { name: 'Untick all' }));
  expect(screen.getByRole('button', { name: /^Remove 0 entries/ })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await screen.findByText('Cancelled. Your tracker was not changed.');
  expect(await entryStorage.load()).toHaveLength(1);
  expect((await loadConversation()).at(-1).action.status).toBe('cancelled');
});

it('requires the count to be typed before removing ten or more', async () => {
  for (let index = 0; index < 12; index += 1) await entryStorage.save(grab(`g${index}`));
  proposeBulk({ category: 'Transport' });
  const user = await ask('delete all transport');
  const remove = screen.getByRole('button', { name: /^Remove 12 entries/ });
  expect(remove).toBeDisabled();
  await user.type(screen.getByLabelText(/Type 12 to confirm/), '11');
  expect(remove).toBeDisabled();
  await user.clear(screen.getByLabelText(/Type 12 to confirm/));
  await user.type(screen.getByLabelText(/Type 12 to confirm/), '12');
  expect(remove).toBeEnabled();
  await user.click(remove);
  await screen.findByText(/Removed\. You can undo/);
  expect(await entryStorage.load()).toHaveLength(0);
});

it('keeps everything when an entry changed after the preview', async () => {
  const [first, second] = [grab('a'), grab('b')];
  await entryStorage.save(first);
  await entryStorage.save(second);
  proposeBulk({ category: 'Transport' });
  const user = await ask('delete transport');
  await entryStorage.save({ ...second, amount_cents: 999 });
  await user.click(screen.getByRole('button', { name: /^Remove 2 entries/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was removed');
  expect(await entryStorage.load()).toHaveLength(2);
});

it('restores the last removal from a chat request, offline, after confirmation', async () => {
  await entryStorage.save(grab('a', 1000));
  await entryStorage.save(grab('b', 2000));
  proposeBulk({ category: 'Transport' });
  const user = await ask('delete all transport');
  await user.click(screen.getByRole('button', { name: /^Remove 2 entries/ }));
  await screen.findByText(/Removed\. You can undo/);
  expect(await entryStorage.load()).toHaveLength(0);
  getAiStatus.mockRejectedValue(new Error('Offline'));
  sendChat.mockClear();
  await user.type(
    screen.getByLabelText('Ask Seite or send a receipt'),
    'add back the deleted data',
  );
  await user.click(screen.getByRole('button', { name: 'Send ↗' }));
  await screen.findByRole('region', { name: 'Restore entries' });
  expect(sendChat).not.toHaveBeenCalled();
  expect(await entryStorage.load()).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: /^Restore 2 entries/ }));
  await screen.findByText('Restored. The entries are back in your tracker.');
  expect(await entryStorage.load()).toHaveLength(2);
  // The earlier removal card now shows as undone, so it cannot be restored twice.
  expect(
    screen.getByText('Undone. The entries are back in your tracker.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
});

it('says plainly when there is no removal to restore', async () => {
  await entryStorage.save(grab('a'));
  const user = userEvent.setup();
  render(<ChatPage navigate={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Ask or add a spend' });
  await user.type(
    screen.getByLabelText('Ask Seite or send a receipt'),
    'restore the deleted entries',
  );
  await user.click(screen.getByRole('button', { name: 'Send ↗' }));
  expect(
    await screen.findByText(/no removal in this chat to restore/),
  ).toBeInTheDocument();
  expect(sendChat).not.toHaveBeenCalled();
});
