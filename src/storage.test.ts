import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, loadPrefs, newId, PREFS_KEY, save, savePrefs, STORAGE_KEY, type KeyValueStore } from './storage.ts';
import type { Transaction } from './ledger.ts';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const sample: Transaction = {
  id: 'x1', kind: 'expense', amount: 1299, category: 'Food', date: '2026-11-06', note: 'pizza',
};

test('save then load returns the same transactions', () => {
  const store = new MemoryStore();
  assert.equal(save(store, [sample]), true);
  assert.deepEqual(load(store), { transactions: [sample], skipped: 0 });
});

test('empty storage loads as an empty ledger', () => {
  assert.deepEqual(load(new MemoryStore()), { transactions: [], skipped: 0 });
});

test('damaged JSON does not throw', () => {
  const store = new MemoryStore();
  store.setItem(STORAGE_KEY, '{not json');
  assert.deepEqual(load(store), { transactions: [], skipped: 1 });
});

test('bad entries are skipped and counted, good ones kept', () => {
  const store = new MemoryStore();
  const bad = [{ ...sample, id: 'b1', amount: -5 }, { ...sample, id: 'b2', date: '2026-02-30' }, 'nope', null];
  store.setItem(STORAGE_KEY, JSON.stringify({ version: 1, transactions: [sample, ...bad] }));
  assert.deepEqual(load(store), { transactions: [sample], skipped: 4 });
});

test('blocked or full storage is reported, not thrown', () => {
  const blocked: KeyValueStore = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
  };
  assert.deepEqual(load(blocked), { transactions: [], skipped: 0 });
  assert.equal(save(blocked, [sample]), false);
});

test('newId is stable for fixed inputs and differs otherwise', () => {
  assert.equal(newId(() => 0, () => 0), '0-000000');
  const ids = new Set(Array.from({ length: 500 }, () => newId()));
  assert.equal(ids.size, 500);
});

test('prefs round-trip and default to empty', () => {
  const store = new MemoryStore();
  assert.deepEqual(loadPrefs(store), { lastCategory: {} });
  savePrefs(store, { lastCategory: { expense: 'Food', income: 'Salary' } });
  assert.deepEqual(loadPrefs(store), { lastCategory: { expense: 'Food', income: 'Salary' } });
});

test('damaged prefs are ignored, valid parts kept', () => {
  const store = new MemoryStore();
  store.setItem(PREFS_KEY, '{nope');
  assert.deepEqual(loadPrefs(store), { lastCategory: {} });
  store.setItem(PREFS_KEY, JSON.stringify({ lastCategory: { expense: 42, income: 'Gift' } }));
  assert.deepEqual(loadPrefs(store), { lastCategory: { income: 'Gift' } });
});
