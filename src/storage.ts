import { isValidDate, type Transaction } from './ledger.ts';

/** The bit of the browser's localStorage we use, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STORAGE_KEY = 'pocketledger:v1';
const VERSION = 1;

interface SavedData {
  version: number;
  transactions: Transaction[];
}

export interface LoadResult {
  transactions: Transaction[];
  /** Entries that were in storage but couldn't be read (damaged or from a newer version). */
  skipped: number;
}

function isTransaction(value: unknown): value is Transaction {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t['id'] === 'string' &&
    (t['kind'] === 'expense' || t['kind'] === 'income') &&
    typeof t['amount'] === 'number' &&
    Number.isInteger(t['amount']) &&
    t['amount'] > 0 &&
    typeof t['category'] === 'string' &&
    typeof t['date'] === 'string' &&
    isValidDate(t['date']) &&
    typeof t['note'] === 'string'
  );
}

/**
 * Reads saved transactions. Never throws: if storage is empty, unreadable or
 * damaged you get what could be recovered, plus a count of what couldn't.
 */
export function load(store: KeyValueStore): LoadResult {
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return { transactions: [], skipped: 0 }; // storage blocked, e.g. private mode
  }
  if (raw === null) return { transactions: [], skipped: 0 };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { transactions: [], skipped: 1 };
  }
  const list = (data as Partial<SavedData> | null)?.transactions;
  if (!Array.isArray(list)) return { transactions: [], skipped: 1 };

  const transactions = list.filter(isTransaction);
  return { transactions, skipped: list.length - transactions.length };
}

/** Saves all transactions. Returns false if the browser refused (full or blocked). */
export function save(store: KeyValueStore, transactions: readonly Transaction[]): boolean {
  const data: SavedData = { version: VERSION, transactions: [...transactions] };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** A short random id that's unique enough for one person's ledger. */
export function newId(random: () => number = Math.random, now: () => number = Date.now): string {
  return `${now().toString(36)}-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
}
