import { describe, expect, it } from 'vitest';
import {
  createBackup,
  createCsv,
  parseBackup,
  planBackupImport,
} from '../src/lib/backups';
import { makeEntry } from './fixtures';

describe('entries backups', () => {
  it('round-trips entries with exact cents and notes', () => {
    const entry = makeEntry({ merchant: 'Cafe “A”', note: 'My share\nPaid in cash' });
    expect(parseBackup(createBackup([entry]))).toEqual([entry]);
  });
  it.each(['invalid JSON', '{}', '{"format":"seite-backup","version":2,"entries":[]}'])(
    'rejects unsupported files',
    (text) => {
      expect(() => parseBackup(text)).toThrow();
    },
  );
  it.each([
    { amount_cents: 1.5 },
    { amount_cents: -1 },
    { date: '2026-02-30' },
    { currency: 'USD' },
    { created_at: '1' },
    { time: 0 },
    { category: 'Unknown' },
    { id: '' },
    { merchant: '' },
  ])('rejects invalid record fields %j', (fields) => {
    expect(() => parseBackup(createBackup([makeEntry(fields)]))).toThrow();
  });
  it('rejects repeated IDs inside one file', () => {
    expect(() => parseBackup(createBackup([makeEntry(), makeEntry()]))).toThrow(
      /repeated entry IDs/,
    );
  });
  it('skips matching IDs and keeps distinct manual entries on the same date and amount', () => {
    const original = makeEntry();
    const additional = makeEntry({ id: 'another-manual-entry' });
    expect(planBackupImport([original, additional], [original])).toEqual({
      added: [additional],
      skipped: 1,
    });
  });
  it('rejects conflicting IDs rather than overwriting existing records', () => {
    expect(() =>
      planBackupImport([makeEntry({ amount_cents: 1000 })], [makeEntry()]),
    ).toThrow(/conflicts/);
  });
  it('ignores unknown fields in imported objects', () => {
    const restored = parseBackup(createBackup([makeEntry({ unexpected: 'ignored' })]));
    expect(restored[0]).not.toHaveProperty('unexpected');
  });
});

describe('spreadsheet exports', () => {
  it('quotes commas, quotes and newlines while preserving cents', () => {
    const csv = createCsv([
      makeEntry({
        merchant: 'Cafe, "A"',
        note: 'Line one\nLine two',
        amount_cents: 1010,
      }),
    ]);
    expect(csv).toContain('"Cafe, ""A"""');
    expect(csv).toContain('"10.10"');
    expect(csv).toContain('"Line one\nLine two"');
  });
  it.each([
    '=SUM(A1)',
    '+SUM(A1)',
    '-10+10',
    '@SUM(A1)',
    '\t=cmd',
    '   =1+1',
    '＝1+1',
    '＋1+1',
    '－1+1',
    '＠SUM(A1)',
  ])('neutralizes formula-like text %j', (merchant) => {
    expect(createCsv([makeEntry({ merchant })])).toContain(`"\t${merchant}"`);
  });
});
