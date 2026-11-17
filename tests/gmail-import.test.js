import { describe, expect, it, vi } from 'vitest';
import { planGmailImport, gmailRef } from '../src/gmail/import';
import {
  clearGmailSettings,
  isScriptUrl,
  loadGmailSettings,
  saveGmailSettings,
  validateGmailSettings,
} from '../src/gmail/settings';
import { ackGmail, fetchPendingGmail, pingGmail } from '../src/gmail/client';
import { makeEntry } from './fixtures';

const item = (overrides = {}) => ({
  id: 'abc123def456',
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

describe('planning a Gmail import', () => {
  it('saves a clear SGD expense automatically with a stable Gmail reference', () => {
    const plan = planGmailImport([item()], [], []);
    expect(plan.auto).toHaveLength(1);
    expect(plan.auto[0]).toMatchObject({
      id: gmailRef('abc123def456'),
      external_ref: 'gmail-abc123def456',
      source: 'gmail_import',
      amount_cents: 1250,
      method: 'PayLah',
      currency: 'SGD',
    });
    expect(plan.ackIds).toEqual(['abc123def456']);
  });
  it.each([
    ['low confidence', { confidence: 0.6 }],
    ['a foreign currency', { currency: 'USD' }],
    ['an unknown payment method', { payment_method: null }],
    ['a vague payment method', { payment_method: 'Other' }],
  ])('asks for review when there is %s', (_, overrides) => {
    const plan = planGmailImport([item(overrides)], [], []);
    expect(plan.auto).toHaveLength(0);
    expect(plan.review).toHaveLength(1);
    expect(plan.review[0].gmailId).toBe('abc123def456');
  });
  it('asks for review instead of double counting a same-day same-amount entry', () => {
    const existing = makeEntry({ date: '2026-11-17', amount_cents: 1250 });
    const plan = planGmailImport([item()], [existing], []);
    expect(plan.auto).toHaveLength(0);
    expect(plan.review).toHaveLength(1);
  });
  it('never logs refunds, income or transfers, but still clears them from the queue', () => {
    const plan = planGmailImport(
      [
        item({ id: 'refund000001', kind: 'refund' }),
        item({ id: 'income000001', kind: 'income' }),
      ],
      [],
      [],
    );
    expect(plan.auto).toHaveLength(0);
    expect(plan.review).toHaveLength(0);
    expect(plan.skipped.notExpense).toBe(2);
    expect(plan.ackIds).toHaveLength(2);
  });
  it('does not add an email twice, whether saved or already waiting for review', () => {
    const saved = makeEntry({ id: 'x', external_ref: 'gmail-abc123def456' });
    expect(planGmailImport([item()], [saved], []).auto).toHaveLength(0);
    const waiting = [{ candidates: [{ gmailId: 'abc123def456' }] }];
    const plan = planGmailImport([item()], [], waiting);
    expect(plan.review).toHaveLength(0);
    expect(plan.skipped.duplicate).toBe(1);
    expect(plan.ackIds).toEqual(['abc123def456']);
  });
  it('handles the same email twice in one batch and rejects malformed items', () => {
    const plan = planGmailImport(
      [item(), item(), { id: 'bad000000001', merchant: '' }, 'junk'],
      [],
      [],
    );
    expect(plan.auto).toHaveLength(1);
    expect(plan.skipped).toMatchObject({ duplicate: 1, invalid: 2 });
  });
  it('rejects an impossible date', () => {
    expect(planGmailImport([item({ date: '2026-02-31' })], [], []).skipped.invalid).toBe(
      1,
    );
  });
});

describe('Gmail connection settings', () => {
  const url = 'https://script.google.com/macros/s/AKfycbxExample_123/exec';
  const key = 'a'.repeat(24);
  it('accepts only a Google Apps Script web app URL and a long enough key', () => {
    expect(isScriptUrl(url)).toBe(true);
    expect(isScriptUrl('https://example.com/exec')).toBe(false);
    expect(isScriptUrl('http://script.google.com/macros/s/abc/exec')).toBe(false);
    expect(() => validateGmailSettings({ url, key: 'short' })).toThrow(/20 characters/);
    expect(() => validateGmailSettings({ url: 'nope', key })).toThrow(/Web app URL/);
  });
  it('saves, loads and clears the connection on this device', () => {
    expect(loadGmailSettings()).toBeNull();
    saveGmailSettings({ url, key });
    expect(loadGmailSettings()).toEqual({ url, key });
    clearGmailSettings();
    expect(loadGmailSettings()).toBeNull();
  });
});

describe('talking to the script', () => {
  const settings = {
    url: 'https://script.google.com/macros/s/AKfycbxExample_123/exec',
    key: 'k'.repeat(24),
  };
  const reply = (body) => vi.fn().mockResolvedValue({ json: async () => body });
  it('reads pending items with the key in the query and acknowledges with a simple POST', async () => {
    const get = reply({
      ok: true,
      items: [item()],
      remaining: 0,
      last_sync: '2026-11-17T10:00:00Z',
    });
    const result = await fetchPendingGmail(settings, get);
    expect(result.items).toHaveLength(1);
    expect(get.mock.calls[0][0]).toContain('action=pending');
    expect(get.mock.calls[0][0]).toContain(`key=${settings.key}`);
    expect(get.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
    const post = reply({ ok: true });
    await ackGmail(settings, ['abc123def456'], post);
    expect(post.mock.calls[0][1].method).toBe('POST');
    expect(post.mock.calls[0][1].headers['Content-Type']).toMatch(/^text\/plain/);
    expect(JSON.parse(post.mock.calls[0][1].body)).toMatchObject({
      action: 'ack',
      ids: ['abc123def456'],
    });
  });
  it('explains a wrong key, an unreachable script and a non-JSON page', async () => {
    await expect(
      pingGmail(settings, reply({ ok: false, error: 'unauthorised' })),
    ).rejects.toThrow(/sync key doesn’t match/);
    await expect(
      pingGmail(settings, vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))),
    ).rejects.toThrow(/Couldn’t reach your Gmail script/);
    const html = vi
      .fn()
      .mockResolvedValue({ json: async () => Promise.reject(new SyntaxError('x')) });
    await expect(pingGmail(settings, html)).rejects.toThrow(/Couldn’t reach/);
  });
});
