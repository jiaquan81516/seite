import { CATEGORIES, PAYMENT_METHODS } from './config';
import { isValidDate, today } from './dates';
import { sortEntries } from './transactions';

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const SOURCES = ['manual', 'gmail_import', 'walletlog', 'grab_receipt', 'ai_chat'];

function normalizeRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record))
    throw new Error('The backup contains an invalid entry.');
  const validText = (value, maximum) =>
    typeof value === 'string' && value.length <= maximum;
  if (
    !validText(record.id, 128) ||
    !record.id.trim() ||
    !validText(record.merchant, 160) ||
    !record.merchant.trim() ||
    !Number.isSafeInteger(record.amount_cents) ||
    record.amount_cents <= 0 ||
    !isValidDate(record.date) ||
    !/^[A-Z]{3}$/.test(record.currency) ||
    (record.currency !== 'SGD' &&
      (!Number.isSafeInteger(record.original_amount_cents) ||
        record.original_amount_cents <= 0 ||
        !Number.isFinite(record.fx_rate) ||
        record.fx_rate <= 0 ||
        !isValidDate(record.fx_date))) ||
    !CATEGORIES.includes(record.category) ||
    !PAYMENT_METHODS.includes(record.method) ||
    (record.time !== undefined &&
      (typeof record.time !== 'string' ||
        (record.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time)))) ||
    (record.note !== undefined && !validText(record.note, 2000)) ||
    (record.refunded !== undefined && typeof record.refunded !== 'boolean') ||
    (record.sensitive !== undefined && typeof record.sensitive !== 'boolean') ||
    !SOURCES.includes(record.source) ||
    !validText(record.created_at, 40) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(record.created_at) ||
    !isValidDate(record.created_at.slice(0, 10)) ||
    !Number.isFinite(Date.parse(record.created_at))
  ) {
    throw new Error(
      'An entry has invalid or unsupported fields. Nothing has been imported.',
    );
  }
  // Copy only known fields; imported JSON is data, never configuration or code.
  return {
    id: record.id,
    merchant: record.merchant,
    amount_cents: record.amount_cents,
    date: record.date,
    time: record.time || '',
    currency: record.currency,
    category: record.category,
    method: record.method,
    note: record.note || '',
    source: record.source,
    created_at: record.created_at,
    ...(record.refunded !== undefined ? { refunded: record.refunded } : {}),
    ...(record.refunded_at
      ? { refunded_at: String(record.refunded_at).slice(0, 40) }
      : {}),
    ...(record.sensitive === true ? { sensitive: true } : {}),
    ...(record.external_ref
      ? { external_ref: String(record.external_ref).slice(0, 200) }
      : {}),
    ...(record.currency !== 'SGD'
      ? {
          original_amount_cents: record.original_amount_cents,
          fx_rate: record.fx_rate,
          fx_date: record.fx_date,
        }
      : {}),
  };
}

export function createBackup(entries) {
  return JSON.stringify(
    {
      format: 'seite-backup',
      version: 1,
      exported_at: new Date().toISOString(),
      entries: sortEntries(entries),
    },
    null,
    2,
  );
}

export function parseBackup(text) {
  if (new Blob([text]).size > MAX_BACKUP_BYTES)
    throw new Error('Choose a backup smaller than 5 MB.');
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('This file isn’t valid JSON. Choose a Seite JSON backup.');
  }
  if (
    backup?.format !== 'seite-backup' ||
    backup.version !== 1 ||
    !Array.isArray(backup.entries) ||
    backup.entries.length > 20000
  ) {
    throw new Error('Choose a supported Seite entries backup (version 1).');
  }
  const records = backup.entries.map(normalizeRecord);
  if (new Set(records.map((record) => record.id)).size !== records.length)
    throw new Error(
      'This backup contains repeated entry IDs. Nothing has been imported.',
    );
  const total = records.reduce((sum, record) => sum + record.amount_cents, 0);
  if (!Number.isSafeInteger(total))
    throw new Error('The total in this backup is too large to store accurately.');
  return records;
}

export function planBackupImport(incoming, existing) {
  const existingById = new Map(existing.map((record) => [record.id, record]));
  const added = [];
  let skipped = 0;
  for (const record of incoming) {
    const previous = existingById.get(record.id);
    if (!previous) {
      added.push(record);
      continue;
    }
    if (
      JSON.stringify(normalizeRecord(previous)) !==
      JSON.stringify(normalizeRecord(record))
    ) {
      throw new Error(
        'An entry ID in this backup conflicts with a saved entry. Nothing has been imported.',
      );
    }
    skipped += 1;
  }
  return { added, skipped };
}

function csvCell(value) {
  let text = String(value ?? '');
  // Check full-width variants too. A leading tab helps spreadsheets treat
  // formula-like values as text; JSON remains the exact, restorable format.
  if (/^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/u.test(text.normalize('NFKC'))) {
    text = `\t${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(entries) {
  const columns = [
    'Date',
    'Time',
    'Merchant',
    'Amount',
    'Currency',
    'Category',
    'Payment method',
    'Note',
    'Source',
    'Refunded',
  ];
  const rows = sortEntries(entries).map((entry) => [
    entry.date,
    entry.time,
    entry.merchant,
    `${Math.floor(entry.amount_cents / 100)}.${String(entry.amount_cents % 100).padStart(2, '0')}`,
    'SGD',
    entry.category,
    entry.method,
    entry.note,
    entry.source,
    entry.refunded ? 'Yes' : 'No',
  ]);
  return (
    '\ufeff' + [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  );
}

export function downloadEntries(contents, extension, mimeType) {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `seite-entries-${today()}.${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
