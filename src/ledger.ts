import type { Cents } from './money.ts';

export type Kind = 'expense' | 'income';

export interface Transaction {
  id: string;
  kind: Kind;
  /** Always positive; `kind` says which way the money went. */
  amount: Cents;
  category: string;
  /** Calendar date as YYYY-MM-DD, in the user's own time zone. */
  date: string;
  note: string;
}

export const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Transport',
  'Housing',
  'Bills',
  'Shopping',
  'Health',
  'Entertainment',
  'Education',
  'Other',
] as const;

export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Gift', 'Other'] as const;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH = /^\d{4}-\d{2}$/;

/** True for a real calendar date written as YYYY-MM-DD (so 2026-02-30 is rejected). */
export function isValidDate(date: string): boolean {
  const m = DATE.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/** "2026-11" for a YYYY-MM-DD date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Today as YYYY-MM-DD in local time (not UTC, which can be a day off). */
export function today(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The month before or after "YYYY-MM", e.g. shiftMonth("2026-01", -1) === "2025-12". */
export function shiftMonth(month: string, delta: number): string {
  if (!MONTH.test(month)) throw new Error(`Not a month: ${month}`);
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export interface NewTransaction {
  kind: Kind;
  amount: Cents;
  category: string;
  date: string;
  note?: string;
}

/** Checks a new entry and returns a list of problems (empty when it's fine). */
export function validate(entry: NewTransaction): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(entry.amount) || entry.amount <= 0) {
    problems.push('Amount must be more than zero.');
  }
  if (!entry.category.trim()) problems.push('Pick a category.');
  if (!isValidDate(entry.date)) problems.push('Pick a valid date.');
  if ((entry.note ?? '').length > 200) problems.push('Keep the note under 200 characters.');
  return problems;
}

export function createTransaction(entry: NewTransaction, id: string): Transaction {
  const problems = validate(entry);
  if (problems.length > 0) throw new Error(problems.join(' '));
  return {
    id,
    kind: entry.kind,
    amount: entry.amount,
    category: entry.category.trim(),
    date: entry.date,
    note: (entry.note ?? '').trim(),
  };
}

/** Newest first; entries on the same day keep the order they were added (newest first). */
export function sortNewestFirst(items: readonly Transaction[]): Transaction[] {
  return items
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.date === b.t.date ? b.i - a.i : a.t.date < b.t.date ? 1 : -1))
    .map(({ t }) => t);
}

export function inMonth(items: readonly Transaction[], month: string): Transaction[] {
  return items.filter((t) => monthOf(t.date) === month);
}

export interface CategoryTotal {
  category: string;
  total: Cents;
  /** Share of the month's spending, 0 to 1. */
  share: number;
}

export interface MonthSummary {
  month: string;
  income: Cents;
  expenses: Cents;
  /** Income minus expenses; negative when you spent more than you earned. */
  balance: Cents;
  /** Spending per category, biggest first. */
  byCategory: CategoryTotal[];
  count: number;
}

export function summarize(items: readonly Transaction[], month: string): MonthSummary {
  const monthly = inMonth(items, month);
  let income = 0;
  let expenses = 0;
  const perCategory = new Map<string, Cents>();
  for (const t of monthly) {
    if (t.kind === 'income') {
      income += t.amount;
    } else {
      expenses += t.amount;
      perCategory.set(t.category, (perCategory.get(t.category) ?? 0) + t.amount);
    }
  }
  const byCategory = [...perCategory.entries()]
    .map(([category, total]) => ({ category, total, share: expenses === 0 ? 0 : total / expenses }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  return { month, income, expenses, balance: income - expenses, byCategory, count: monthly.length };
}

/** Every month that has at least one entry, newest first. */
export function monthsWithEntries(items: readonly Transaction[]): string[] {
  return [...new Set(items.map((t) => monthOf(t.date)))].sort().reverse();
}

export interface Removal {
  transaction: Transaction;
  /** Where it was in the list, so undo can put it back in the same place. */
  index: number;
}

/** Removes the entry with `id`. Returns the new list and what was removed (null if not found). */
export function removeTransaction(
  items: readonly Transaction[],
  id: string,
): { items: Transaction[]; removed: Removal | null } {
  const index = items.findIndex((t) => t.id === id);
  if (index === -1) return { items: [...items], removed: null };
  const transaction = items[index] as Transaction;
  return { items: [...items.slice(0, index), ...items.slice(index + 1)], removed: { transaction, index } };
}

/** Puts a removed entry back where it was. Does nothing if it's already there. */
export function restoreTransaction(items: readonly Transaction[], removal: Removal): Transaction[] {
  if (items.some((t) => t.id === removal.transaction.id)) return [...items];
  const at = Math.min(Math.max(removal.index, 0), items.length);
  return [...items.slice(0, at), removal.transaction, ...items.slice(at)];
}
