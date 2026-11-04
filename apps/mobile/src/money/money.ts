import { currencyExponent } from '@/money/currencies';

/** Thrown for malformed decimal strings and non-integer / unsafe minor amounts. */
export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
  }
}

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?$/;

/**
 * Parse a decimal string ("12.34", "-1.25", "12", ".5") to integer minor units.
 * Excess fraction digits are rounded half-up away from zero. Digit-string
 * arithmetic only. Throws InvalidAmountError on malformed input or
 * results beyond Number.MAX_SAFE_INTEGER.
 */
export function toMinor(decimal: string, code: string): number {
  const exponent = currencyExponent(code);
  const m = DECIMAL.exec(decimal);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) {
    throw new InvalidAmountError(`Invalid amount: "${decimal}"`);
  }
  const negative = m[1] === '-';
  const whole = m[2];
  const frac = m[3] ?? '';
  const kept = frac.slice(0, exponent).padEnd(exponent, '0');
  const roundUp = frac.length > exponent && frac.charCodeAt(exponent) >= 53; // '5'
  let magnitude = BigInt((whole || '0') + kept);
  if (roundUp) magnitude += 1n;
  const value = negative ? -magnitude : magnitude;
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new InvalidAmountError(`Amount out of range: "${decimal}"`);
  }
  return Number(value) + 0; // + 0 normalises -0
}

/** Integer minor units to a plain decimal string: (1234,'USD') -> "12.34". */
export function fromMinor(minor: number, code: string): string {
  const exponent = currencyExponent(code);
  if (!Number.isSafeInteger(minor)) {
    throw new InvalidAmountError(`Minor amount must be a safe integer: ${minor}`);
  }
  const negative = minor < 0;
  const digits = String(Math.abs(minor)).padStart(exponent + 1, '0');
  const body =
    exponent === 0 ? digits : `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
  return negative ? `-${body}` : body;
}

/** Locale-formatted currency string. Display only; never parse the result. */
export function formatMoney(minor: number, code: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(
    Number(fromMinor(minor, code)),
  );
}
