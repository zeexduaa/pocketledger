/**
 * Money is stored as a whole number of cents, never as a float, so that
 * 0.1 + 0.2 really is 0.3 and totals always add up.
 */

export type Cents = number;

const AMOUNT = /^\s*(\d{1,9})(?:[.,](\d{1,2}))?\s*$/;

/**
 * Turns what someone typed into cents: "12", "12.5", "$1,250.00", "1 250", and
 * "12,50" (a comma as the decimal point) all work.
 * Returns null for anything that isn't a positive amount with at most two decimals.
 */
export function parseAmount(input: string): Cents | null {
  let cleaned = input.replace(/[\s ]/g, '').replace(/^[$€£]/, '');
  if (cleaned.includes('.') || /^\d{1,3}(,\d{3})+$/.test(cleaned)) {
    cleaned = cleaned.replace(/,(?=\d{3}(\D|$))/g, ''); // commas as thousands separators
  }
  const match = AMOUNT.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = match[2] === undefined ? 0 : Number(match[2].padEnd(2, '0'));
  const cents = whole * 100 + fraction;
  return cents > 0 ? cents : null;
}

/** Formats cents for display, e.g. 123456 -> "$1,234.56" for en-US and USD. */
export function formatCents(cents: Cents, currency = 'USD', locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/** Cents as a plain decimal string with two places ("1234.56"), for CSV files. */
export function centsToDecimal(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
