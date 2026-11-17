import { shiftDays, today } from '../lib/dates';
import { entryStorage } from '../lib/storage';

// Demo mode stands in for the Gmail script with simulated bank emails. It uses
// the same queue, collect and acknowledge steps as the real connection, so the
// whole flow can be shown without setting anything up. Nothing here reads a
// real inbox, and every saved entry is labelled as demo data.
export const DEMO_FLAG = 'seite-gmail-demo';
export const DEMO_QUEUE = 'seite-gmail-demo-queue';
const DEMO_NEXT = 'seite-gmail-demo-next';
export const DEMO_PREFIX = 'demo';

const item = (spec, daysAgo = 0) => ({
  merchant: spec.merchant,
  amount: spec.amount,
  currency: spec.currency || 'SGD',
  date: shiftDays(today(), -daysAgo),
  time: spec.time ?? '12:30',
  payment_method: spec.method ?? null,
  category: spec.category,
  kind: spec.kind || 'expense',
  confidence: spec.confidence ?? 0.95,
});

// A first batch that shows every outcome: saved automatically, needs review
// (foreign currency, unclear), and skipped (refund).
const STARTER = [
  [
    {
      merchant: 'Grab',
      amount: 14.2,
      method: 'PayLah',
      category: 'Transport',
      time: '08:41',
    },
    0,
  ],
  [
    {
      merchant: 'Starbucks',
      amount: 7.8,
      method: 'Apple Pay',
      category: 'Food & Drink',
      time: '09:05',
    },
    0,
  ],
  [
    {
      merchant: 'FairPrice',
      amount: 32.45,
      method: 'Card',
      category: 'Groceries',
      time: '19:12',
      confidence: 0.93,
    },
    1,
  ],
  [
    {
      merchant: 'Netflix',
      amount: 15.49,
      currency: 'USD',
      method: 'Card',
      category: 'Entertainment',
      time: '03:00',
    },
    2,
  ],
  [
    {
      merchant: 'POS 8841 SG',
      amount: 18,
      method: null,
      category: 'Other',
      confidence: 0.55,
      time: '',
    },
    1,
  ],
  [
    {
      merchant: 'Shopee',
      amount: 25,
      method: 'ShopeePay',
      category: 'Shopping',
      kind: 'refund',
      time: '10:20',
    },
    0,
  ],
];
// One more arrives each time "Simulate a new email" is pressed.
const EXTRA = [
  { merchant: 'ComfortDelGro', amount: 18.6, method: 'Card', category: 'Transport' },
  { merchant: 'Koufu', amount: 6.4, method: 'PayLah', category: 'Food & Drink' },
  { merchant: 'Guardian', amount: 23.9, method: 'SC Card', category: 'Health' },
  {
    merchant: 'Spotify',
    amount: 9.99,
    currency: 'USD',
    method: 'Card',
    category: 'Entertainment',
  },
  {
    merchant: 'SP Services',
    amount: 88.3,
    method: 'Card',
    category: 'Bills & Utilities',
  },
  { merchant: 'Toast Box', amount: 5.6, method: 'Apple Pay', category: 'Food & Drink' },
  {
    merchant: 'Cold Storage',
    amount: 41.15,
    method: 'Card',
    category: 'Groceries',
    confidence: 0.6,
  },
];

const newId = () =>
  `${DEMO_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const isDemoId = (id) => String(id).startsWith(DEMO_PREFIX);

export const isDemoMode = () => localStorage.getItem(DEMO_FLAG) === '1';
function readQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem(DEMO_QUEUE) || '[]');
    return Array.isArray(queue) ? queue : [];
  } catch {
    return [];
  }
}
const writeQueue = (queue) => localStorage.setItem(DEMO_QUEUE, JSON.stringify(queue));

export function enableDemo() {
  if (isDemoMode()) return;
  localStorage.setItem(DEMO_FLAG, '1');
  writeQueue(
    STARTER.map(([spec, daysAgo]) => ({
      id: newId(),
      received_at: new Date().toISOString(),
      ...item(spec, daysAgo),
    })),
  );
}

export function disableDemo() {
  for (const key of [DEMO_FLAG, DEMO_QUEUE, DEMO_NEXT]) localStorage.removeItem(key);
}

export function simulateIncoming() {
  const index = Number(localStorage.getItem(DEMO_NEXT) || 0) % EXTRA.length;
  localStorage.setItem(DEMO_NEXT, String(index + 1));
  const email = {
    id: newId(),
    received_at: new Date().toISOString(),
    ...item(EXTRA[index], 0),
    time: new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Singapore',
    }),
  };
  writeQueue([...readQueue(), email]);
  return email;
}

export function demoFetchPending() {
  return {
    items: readQueue().slice(0, 50),
    remaining: 0,
    lastSync: new Date().toISOString(),
  };
}

export function demoAck(ids) {
  writeQueue(readQueue().filter((email) => !ids.includes(email.id)));
}

export const isDemoEntry = (entry) =>
  String(entry.external_ref || '').startsWith(`gmail-${DEMO_PREFIX}`);

export async function countDemoEntries() {
  return (await entryStorage.load()).filter(isDemoEntry).length;
}

// Removes only entries that came from demo emails. Manual and real entries stay.
export async function removeDemoEntries() {
  const demo = (await entryStorage.load()).filter(isDemoEntry);
  for (const entry of demo) await entryStorage.remove(entry.id);
  return demo.length;
}
