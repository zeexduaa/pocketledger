import { centsToDecimal } from './money.ts';
import { sortNewestFirst, type Transaction } from './ledger.ts';

const HEADER = ['date', 'type', 'category', 'amount', 'note'];

/**
 * Quotes a CSV field when it needs it (commas, quotes, line breaks), and defuses
 * text that a spreadsheet would run as a formula (=, +, -, @ at the start).
 */
export function csvField(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** All transactions as CSV, newest first. Expenses are negative amounts, income positive. */
export function toCsv(items: readonly Transaction[]): string {
  const rows = sortNewestFirst(items).map((t) =>
    [
      t.date,
      t.kind,
      csvField(t.category),
      centsToDecimal(t.kind === 'expense' ? -t.amount : t.amount),
      csvField(t.note),
    ].join(','),
  );
  return [HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}
