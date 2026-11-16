import { CURRENCIES, currencyExponent, UnknownCurrencyError } from '@/money/currencies';
import { formatMoney, fromMinor, InvalidAmountError, toMinor } from '@/money/money';

describe('currencies', () => {
  it('has expected exponents', () => {
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('IDR')).toBe(2);
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('VND')).toBe(0);
    expect(currencyExponent('KWD')).toBe(3);
  });
  it('throws UnknownCurrencyError for non-currency/unknown codes', () => {
    expect(() => currencyExponent('XXX')).toThrow(UnknownCurrencyError);
    expect(() => currencyExponent('XAU')).toThrow(UnknownCurrencyError);
    expect(() => currencyExponent('usd')).toThrow(UnknownCurrencyError);
  });
  it('has unique codes', () => {
    expect(new Set(CURRENCIES.map((c) => c.code)).size).toBe(CURRENCIES.length);
  });
});

describe('toMinor', () => {
  it('parses basic values', () => {
    expect(toMinor('12.34', 'USD')).toBe(1234);
    expect(toMinor('12', 'USD')).toBe(1200);
    expect(toMinor('1500', 'JPY')).toBe(1500);
    expect(toMinor('0.1', 'USD')).toBe(10);
    expect(toMinor('.5', 'USD')).toBe(50);
    expect(toMinor('5.', 'USD')).toBe(500);
  });
  it('rounds half-up on excess digits', () => {
    expect(toMinor('1.2345', 'KWD')).toBe(1235);
    expect(toMinor('1.005', 'USD')).toBe(101);
    expect(toMinor('1.004', 'USD')).toBe(100);
    expect(toMinor('0.5', 'JPY')).toBe(1);
    expect(toMinor('0.4999', 'JPY')).toBe(0);
    expect(toMinor('9.995', 'USD')).toBe(1000);
  });
  it('handles negatives, rounding away from zero', () => {
    expect(toMinor('-1.25', 'USD')).toBe(-125);
    expect(toMinor('-1.005', 'USD')).toBe(-101);
    expect(toMinor('-0.5', 'JPY')).toBe(-1);
    expect(toMinor('-0', 'USD')).toBe(0);
    expect(Object.is(toMinor('-0.001', 'USD'), 0)).toBe(true);
    expect(toMinor('+2.5', 'USD')).toBe(250);
  });
  it('rejects malformed input', () => {
    for (const bad of ['abc', '1.2.3', '', ' ', '.', '-', '1e3', '1,5', ' 1', '--1']) {
      expect(() => toMinor(bad, 'USD')).toThrow(InvalidAmountError);
    }
  });
  it('rejects unsafe integers', () => {
    expect(() => toMinor('99999999999999999999', 'USD')).toThrow(InvalidAmountError);
  });
  it('throws for unknown currency', () => {
    expect(() => toMinor('1', 'XXX')).toThrow(UnknownCurrencyError);
  });
});

describe('fromMinor', () => {
  it('formats', () => {
    expect(fromMinor(1234, 'USD')).toBe('12.34');
    expect(fromMinor(5, 'USD')).toBe('0.05');
    expect(fromMinor(1500, 'JPY')).toBe('1500');
    expect(fromMinor(1235, 'KWD')).toBe('1.235');
    expect(fromMinor(0, 'USD')).toBe('0.00');
    expect(fromMinor(-125, 'USD')).toBe('-1.25');
    expect(fromMinor(-5, 'USD')).toBe('-0.05');
  });
  it('rejects non-integers', () => {
    expect(() => fromMinor(1.5, 'USD')).toThrow(InvalidAmountError);
    expect(() => fromMinor(NaN, 'USD')).toThrow(InvalidAmountError);
  });
  it('round-trips', () => {
    for (const m of [0, 1, -1, 99, 100, 123456789, -987654321]) {
      expect(toMinor(fromMinor(m, 'USD'), 'USD')).toBe(m);
    }
  });
});

describe('formatMoney', () => {
  it('formats in locale', () => {
    expect(formatMoney(1234, 'EUR', 'de-DE')).toContain('12,34');
    expect(formatMoney(1500, 'JPY', 'en-US')).toContain('1,500');
    expect(formatMoney(-125, 'USD', 'en-US')).toContain('1.25');
  });
  it('shows rupiah without sen, as Indonesian receipts print it', () => {
    expect(formatMoney(15697500, 'IDR', 'id-ID').replace(/\s/g, ' ')).toBe('Rp 156.975');
    expect(formatMoney(84402022, 'IDR', 'id-ID').replace(/\s/g, ' ')).toBe('Rp 844.020');
    expect(formatMoney(2000000, 'IDR', 'en-US').replace(/\s/g, ' ')).toBe('IDR 20,000');
  });
  it('asks Intl for 0 rupiah fraction digits (older ICU, e.g. Android, defaults IDR to 2)', () => {
    const spy = jest.spyOn(Intl, 'NumberFormat');
    try {
      formatMoney(15697500, 'IDR', 'id-x-icu-old');
      formatMoney(1234, 'EUR', 'de-x-icu-old');
      const opts = (code: string) => spy.mock.calls.find((c) => (c[1] as Intl.NumberFormatOptions).currency === code)?.[1];
      expect(opts('IDR')).toMatchObject({ minimumFractionDigits: 0, maximumFractionDigits: 0 });
      expect(opts('EUR')).not.toHaveProperty('maximumFractionDigits');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('formatMoney formatter cache', () => {
  it('builds one Intl.NumberFormat per locale and currency', () => {
    const spy = jest.spyOn(Intl, 'NumberFormat');
    const a1 = formatMoney(1234, 'XAF', 'fr-FR');
    const a2 = formatMoney(5678, 'XAF', 'fr-FR');
    const b = formatMoney(1234, 'XAF', 'en-US');
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
    expect(a1).toBe(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(1234));
    expect(a2).toBe(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(5678));
    expect(b).toBe(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF' }).format(1234));
  });
});
