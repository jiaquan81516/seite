import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPage from '../src/pages/ChatPage';
import { getAiStatus, sendChat } from '../src/chat/api';
import { entryStorage } from '../src/lib/storage';
import {
  loadConversation,
  loadMerchantRules,
  saveConversation,
} from '../src/chat/storage';
import { aiReply, extractedSpend } from './ai-fixtures';
import { makeEntry } from './fixtures';
import { today, shiftDays } from '../src/lib/dates';
vi.mock('../src/chat/api', () => ({
  getAiStatus: vi.fn(),
  sendChat: vi.fn(),
  fetchExchangeRate: vi.fn(),
}));
vi.mock('../src/chat/attachments', () => ({
  imageAttachment: vi.fn().mockResolvedValue({
    name: 'receipt.png',
    mediaType: 'image/jpeg',
    data: 'aW1hZ2U=',
  }),
  openPdf: vi.fn(),
  pdfPageAttachment: vi.fn(),
}));
beforeEach(async () => {
  await entryStorage.clear();
  localStorage.clear();
  getAiStatus.mockResolvedValue({
    cloud: [{ provider: 'gemini', configured: true }],
    local: { configured: true },
    setup: '',
  });
  sendChat.mockResolvedValue({ ...aiReply(), provider: 'gemini', model: 'test-model' });
});
async function startChat() {
  const user = userEvent.setup();
  render(<ChatPage navigate={vi.fn()} onViewEntries={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Ask or add a spend' });
  return user;
}
async function ask(user, text = 'Read my receipt.') {
  await user.type(screen.getByLabelText('Ask Seite or send a receipt'), text);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Send ↗' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Send ↗' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Send ↗' })).toBeInTheDocument(),
  );
}
describe('AI receipt chat', () => {
  it('keeps a saved receipt card in sync after removal and Undo in chat', async () => {
    const user = await startChat();
    await ask(user);
    await user.click(screen.getByRole('button', { name: 'Save selected (1)' }));
    await screen.findByText('✓ Saved');
    await ask(user, 'remove the recently added log');
    await user.click(screen.getByRole('button', { name: 'Remove entry' }));
    await screen.findByText('Removed from tracker');
    expect(await entryStorage.load()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await screen.findByText('✓ Saved');
    expect(await entryStorage.load()).toHaveLength(1);
  });
  it('cancels an unsaved receipt review and persists the dismissal', async () => {
    const user = await startChat();
    await ask(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByText('Review cancelled. Unsaved items were discarded.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Save selected/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /Add this spend/ }),
    ).not.toBeInTheDocument();
    expect(await entryStorage.load()).toEqual([]);
    expect(await loadMerchantRules()).toEqual([]);
    expect((await loadConversation()).at(-1)).toMatchObject({
      reviewCancelled: true,
      candidates: [],
    });
  });
  it('cancels only remaining drafts after saving part of a receipt', async () => {
    sendChat.mockResolvedValue({
      ...aiReply({
        transactions: [
          extractedSpend,
          { ...extractedSpend, merchant: 'Ride', amount: 7.5, category: 'Transport' },
        ],
      }),
      provider: 'gemini',
      model: 'test-model',
    });
    const user = await startChat();
    await ask(user);
    await user.click(screen.getAllByRole('checkbox', { name: /Add this spend/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Save selected (1)' }));
    await screen.findByText('✓ Saved');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('Review cancelled. Unsaved items were discarded.');
    expect(screen.getByText('✓ Saved')).toBeInTheDocument();
    expect(await entryStorage.load()).toHaveLength(1);
    expect(
      (await loadConversation()).find((message) => message.reviewCancelled).candidates,
    ).toHaveLength(1);
    expect(
      (await loadConversation()).find((message) => message.reviewCancelled).candidates[0]
        .saved,
    ).toBe(true);
  });
  it('answers today from saved entries without cloud consent or an available AI service', async () => {
    const date = today();
    await entryStorage.save(makeEntry({ date, amount_cents: 320 }));
    await entryStorage.save(
      makeEntry({ id: 'private', date, amount_cents: 210, sensitive: true }),
    );
    await entryStorage.save(
      makeEntry({ id: 'refund', date, amount_cents: 9999, refunded: true }),
    );
    await entryStorage.save(
      makeEntry({ id: 'yesterday', date: shiftDays(date, -1), amount_cents: 8888 }),
    );
    getAiStatus.mockRejectedValue(new Error('Service unavailable'));
    const onViewEntries = vi.fn();
    const user = userEvent.setup();
    render(<ChatPage navigate={vi.fn()} onViewEntries={onViewEntries} />);
    await screen.findByRole('heading', { name: 'Ask or add a spend' });
    await ask(user, 'how much did spend today');
    expect(
      await screen.findByText('You spent S$5.30 today across 2 entries.'),
    ).toBeInTheDocument();
    expect(sendChat).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'View these entries ↓' }));
    // The summary opens inside the chat. It does not navigate to the tracker.
    expect(onViewEntries).not.toHaveBeenCalled();
    expect(screen.getByText('2 entries · S$5.30')).toBeInTheDocument();
    expect(screen.queryByText(/S\$88\.88/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide entries ↑' }));
    expect(screen.queryByText('2 entries · S$5.30')).not.toBeInTheDocument();
    const history = await loadConversation();
    expect(history.at(-1)).toMatchObject({ sensitive: true, provider: 'On this device' });
    expect(await entryStorage.load()).toHaveLength(4);
  });
  it('answers with zero when no entries are saved', async () => {
    const user = await startChat();
    await ask(user, 'How much did I spend today?');
    expect(
      await screen.findByText('You spent S$0.00 today across 0 entries.'),
    ).toBeInTheDocument();
    expect(sendChat).not.toHaveBeenCalled();
  });
  it('opens directly in Gemini chat without AI declaration controls', async () => {
    const user = await startChat();
    expect(screen.queryByLabelText('AI mode')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Sensitive/ })).not.toBeInTheDocument();
    await ask(user);
    expect(sendChat.mock.calls[0][0]).toMatchObject({
      mode: 'cloud',
      cloudConsent: true,
    });
  });
  it('extracts several spends but saves exactly the selected reviewed item', async () => {
    sendChat.mockResolvedValue({
      ...aiReply({
        transactions: [
          extractedSpend,
          { ...extractedSpend, merchant: 'Ride', amount: 7.5, category: 'Transport' },
        ],
      }),
      provider: 'gemini',
      model: 'test-model',
    });
    const user = await startChat();
    await ask(user);
    expect(await entryStorage.load()).toEqual([]);
    const selections = screen.getAllByRole('checkbox', { name: /Add this spend/ });
    await user.click(selections[0]);
    await user.click(screen.getByRole('button', { name: 'Save selected (1)' }));
    await waitFor(() => expect(screen.getByText('✓ Saved')).toBeInTheDocument());
    const saved = await entryStorage.load();
    expect(saved).toHaveLength(1);
    expect(
      await screen.findByText('Saved Ride (S$7.50) to your tracker.'),
    ).toBeInTheDocument();
    expect((await loadConversation()).at(-1)).toMatchObject({
      role: 'assistant',
      text: 'Saved Ride (S$7.50) to your tracker.',
    });
    expect(saved[0]).toMatchObject({
      merchant: 'Ride',
      amount_cents: 750,
      date: '2026-11-16',
      source: 'ai_chat',
    });
  });
  it('defaults a duplicate to unselected and requires Add anyway', async () => {
    await entryStorage.save(makeEntry({ date: '2026-11-16' }));
    const user = await startChat();
    await ask(user);
    expect(screen.getByText(/This looks like/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Add this spend/ })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /Add this spend/ }));
    await user.click(screen.getByRole('button', { name: 'Save selected (1)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('looks like a duplicate');
    expect(await entryStorage.load()).toHaveLength(1);
    expect((await loadConversation()).some((message) => message.completionKey)).toBe(
      false,
    );
    await user.click(screen.getByRole('checkbox', { name: /Add anyway/ }));
    await user.click(screen.getByRole('button', { name: 'Save selected (1)' }));
    await waitFor(() => expect(screen.getByText('✓ Saved')).toBeInTheDocument());
    expect(await entryStorage.load()).toHaveLength(2);
  });
  it('sends images without extra confirmation and keeps image bytes out of history', async () => {
    const user = await startChat();
    await user.upload(
      screen.getByLabelText(/Photo or PDF/),
      new File(['image'], 'receipt.png', { type: 'image/png' }),
    );
    await screen.findByAltText('Selected attachment');
    expect(
      screen.queryByRole('checkbox', { name: /cropped or redacted/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send ↗' }));
    await screen.findByRole('button', { name: 'Save selected (1)' });
    expect(sendChat.mock.calls[0][0]).toMatchObject({
      image: { mediaType: 'image/jpeg' },
      context: { facts: [], recent: [] },
    });
    expect(JSON.stringify(await loadConversation())).not.toContain('aW1hZ2U=');
  });
  it('applies a confirmed category correction and remembers the merchant', async () => {
    await entryStorage.save(makeEntry({ merchant: 'Kopi & Toast' }));
    sendChat.mockResolvedValue({
      ...aiReply({
        kind: 'correction',
        transactions: [],
        correction: { target_id: 'cafe', category: 'Groceries' },
      }),
      provider: 'gemini',
      model: 'test-model',
    });
    const user = await startChat();
    await ask(user, 'That was groceries, not food.');
    expect((await entryStorage.load())[0].category).toBe('Food & Drink');
    await user.click(screen.getByRole('button', { name: 'Apply category correction' }));
    await waitFor(() =>
      expect(screen.getByText(/Changed to Groceries/)).toBeInTheDocument(),
    );
    expect((await entryStorage.load())[0].category).toBe('Groceries');
    expect((await loadConversation()).at(-1)).toMatchObject({
      role: 'assistant',
      text: 'Changed to Groceries. I’ll remember this merchant next time.',
    });
    expect(await loadMerchantRules()).toEqual([
      { merchant: 'kopi & toast', category: 'Groceries' },
    ]);
  });
  it('fills the composer from a suggestion without sending automatically', async () => {
    const user = await startChat();
    await user.click(screen.getByRole('button', { name: /Today’s spending/ }));
    expect(screen.getByLabelText('Ask Seite or send a receipt')).toHaveValue(
      'How much did I spend today?',
    );
    expect(screen.getByLabelText('Ask Seite or send a receipt')).toHaveFocus();
    expect(sendChat).not.toHaveBeenCalled();
  });
  it('excludes local-only history and entries from later cloud requests', async () => {
    await entryStorage.save(makeEntry({ sensitive: true, merchant: 'Private clinic' }));
    await saveConversation([
      {
        id: 'private-chat',
        role: 'user',
        text: 'Private local-only details',
        sensitive: true,
      },
    ]);
    const user = userEvent.setup();
    render(<ChatPage navigate={vi.fn()} onViewEntries={vi.fn()} />);
    await screen.findByText('Private local-only details');
    await ask(user, 'Can you explain my spending habits?');
    const request = sendChat.mock.calls[0][0];
    expect(JSON.stringify(request)).not.toContain('Private clinic');
    expect(JSON.stringify(request)).not.toContain('Private local-only details');
    expect(request.context.facts[0].text).toContain('Shared entries only.');
  });
  it('offers to mark the exact original spend as fully refunded', async () => {
    await entryStorage.save(makeEntry());
    sendChat.mockResolvedValue({
      ...aiReply({ transactions: [{ ...extractedSpend, kind: 'refund' }] }),
      provider: 'gemini',
      model: 'test-model',
    });
    const user = await startChat();
    await ask(user, 'This is a refund.');
    await user.click(screen.getByLabelText('Original spend'));
    await user.click(screen.getByRole('option', { name: /Test cafe/ }));
    await user.click(screen.getByRole('checkbox', { name: /full refund/ }));
    await user.click(screen.getByRole('button', { name: 'Mark original as refunded' }));
    await screen.findByText('✓ Original spend marked as refunded.');
    expect((await entryStorage.load())[0].refunded).toBe(true);
    expect(
      await screen.findByText(
        'Marked Test cafe (S$9.20) as refunded. It is excluded from spending totals.',
      ),
    ).toBeInTheDocument();
    expect((await loadConversation()).at(-1).completionKey).toContain(':refunded:');
    expect(await entryStorage.load()).toHaveLength(1);
  });
});
