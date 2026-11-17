import { formatMoney, totalAmount } from '../lib/money';
import { redactSensitiveText } from '../../shared/privacy';

export function entryLabel(entry) {
  return `${redactSensitiveText(entry.merchant)} (${formatMoney(entry.amount_cents)})`;
}

export function savedEntriesText(entries) {
  return entries.length === 1
    ? `Saved ${entryLabel(entries[0])} to your tracker.`
    : `Saved ${entries.length} entries totalling ${formatMoney(totalAmount(entries))} to your tracker.`;
}

// Call inside the same storage transaction as the change. A failed write never
// displays or persists a success message, and repeated actions stay idempotent.
export function appendCompletion(messages, { key, text, sensitive = false }) {
  if (messages.some((message) => message.completionKey === key)) return messages;
  return [
    ...messages,
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: redactSensitiveText(text),
      sensitive: Boolean(sensitive),
      completionKey: key,
      created_at: new Date().toISOString(),
    },
  ];
}
