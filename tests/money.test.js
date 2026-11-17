import { describe, expect, it } from 'vitest';
import { formatMoney, parseAmount, totalAmount } from '../src/lib/money';
describe('money', () => {
  it('parses decimal strings into exact integer cents', () => {
    expect(parseAmount('0.10') + parseAmount('0.20')).toBe(30);
    expect(parseAmount('63.69')).toBe(6369);
    expect(parseAmount('9.2')).toBe(920);
    expect(totalAmount([{ amount_cents: 10 }, { amount_cents: 20 }])).toBe(30);
  });
  it.each(['1.001', '-2', '0', 'NaN', '1e3', 'Infinity', '9007199254740993'])(
    'rejects invalid amount %s',
    (value) => {
      expect(() => parseAmount(value)).toThrow();
    },
  );
  it('formats home currency', () => {
    expect(formatMoney(920)).toBe('S$9.20');
  });
});
