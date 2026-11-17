import { describe, expect, it } from 'vitest';
import {
  daysInPeriod,
  isValidDate,
  movePeriod,
  periodRange,
  shiftDays,
} from '../src/lib/dates';
describe('calendar periods', () => {
  it('uses Monday to Sunday, including across month boundaries', () => {
    expect(periodRange('2026-11-01', 'Week')).toEqual(['2026-10-26', '2026-11-01']);
  });
  it('includes leap day', () => {
    expect(periodRange('2028-02-12', 'Month')).toEqual(['2028-02-01', '2028-02-29']);
    expect(daysInPeriod('2028-02-12', 'Month')).toHaveLength(29);
  });
  it('moves periods without overflowing short months', () => {
    expect(movePeriod('2026-01-31', 'Month', 1)).toBe('2026-02-01');
    expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it.each(['2026-02-30', '2026-13-01', '', 'not a date'])(
    'rejects invalid date %s',
    (date) => {
      expect(isValidDate(date)).toBe(false);
    },
  );
});
