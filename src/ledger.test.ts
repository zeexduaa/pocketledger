import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTransaction,
  isValidDate,
  monthsWithEntries,
  removeTransaction,
  restoreTransaction,
  shiftMonth,
  sortNewestFirst,
  summarize,
  today,
  validate,
  type NewTransaction,
  type Transaction,
} from './ledger.ts';

let counter = 0;
function tx(kind: Transaction['kind'], amount: number, category: string, date: string, note = ''): Transaction {
  counter += 1;
  return createTransaction({ kind, amount, category, date, note }, `id-${counter}`);
}

test('isValidDate accepts real dates only', () => {
  assert.ok(isValidDate('2026-11-06'));
  assert.ok(isValidDate('2024-02-29')); // leap year
  for (const bad of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-1-5', '06/11/2026', '']) {
    assert.equal(isValidDate(bad), false, bad);
  }
});

test('today uses local date parts', () => {
  assert.equal(today(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('shiftMonth crosses year boundaries', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2025-12', 1), '2026-01');
  assert.equal(shiftMonth('2026-06', 0), '2026-06');
  assert.equal(shiftMonth('2026-06', -18), '2024-12');
  assert.throws(() => shiftMonth('June', 1));
});

test('validate explains every problem', () => {
  const bad: NewTransaction = { kind: 'expense', amount: 0, category: ' ', date: '2026-02-30', note: 'x'.repeat(201) };
  assert.equal(validate(bad).length, 4);
  assert.deepEqual(validate({ kind: 'income', amount: 100, category: 'Salary', date: '2026-11-01' }), []);
});

test('createTransaction trims text and refuses bad entries', () => {
  const t = createTransaction({ kind: 'expense', amount: 450, category: ' Food ', date: '2026-11-02', note: ' lunch ' }, 'a');
  assert.equal(t.category, 'Food');
  assert.equal(t.note, 'lunch');
  assert.throws(() => createTransaction({ kind: 'expense', amount: -1, category: 'Food', date: '2026-11-02' }, 'b'));
});

test('summarize totals one month and ranks categories', () => {
  const items = [
    tx('income', 300000, 'Salary', '2026-11-01'),
    tx('expense', 120000, 'Housing', '2026-11-01'),
    tx('expense', 4550, 'Food', '2026-11-03'),
    tx('expense', 2000, 'Food', '2026-11-10'),
    tx('expense', 6550, 'Transport', '2026-11-12'),
    tx('expense', 99999, 'Shopping', '2026-10-31'), // other month
  ];
  const s = summarize(items, '2026-11');
  assert.equal(s.income, 300000);
  assert.equal(s.expenses, 133100);
  assert.equal(s.balance, 166900);
  assert.equal(s.count, 5);
  assert.deepEqual(
    s.byCategory.map((c) => [c.category, c.total]),
    [['Housing', 120000], ['Food', 6550], ['Transport', 6550]],
  );
  const shareSum = s.byCategory.reduce((sum, c) => sum + c.share, 0);
  assert.ok(Math.abs(shareSum - 1) < 1e-9);
});

test('summarize handles an empty month and overspending', () => {
  assert.deepEqual(summarize([], '2026-01'), {
    month: '2026-01', income: 0, expenses: 0, balance: 0, byCategory: [], count: 0,
  });
  const s = summarize([tx('expense', 500, 'Food', '2026-01-02')], '2026-01');
  assert.equal(s.balance, -500);
  assert.equal(s.byCategory[0]?.share, 1);
});

test('sortNewestFirst orders by date, then most recently added', () => {
  const a = tx('expense', 1, 'Food', '2026-11-01');
  const b = tx('expense', 1, 'Food', '2026-11-05');
  const c = tx('expense', 1, 'Food', '2026-11-01');
  assert.deepEqual(sortNewestFirst([a, b, c]).map((t) => t.id), [b.id, c.id, a.id]);
});

test('monthsWithEntries lists distinct months, newest first', () => {
  const items = [tx('expense', 1, 'Food', '2025-12-31'), tx('expense', 1, 'Food', '2026-02-01'), tx('income', 1, 'Gift', '2026-02-14')];
  assert.deepEqual(monthsWithEntries(items), ['2026-02', '2025-12']);
});

test('removeTransaction and restoreTransaction put an entry back in place', () => {
  const items = [tx('expense', 1, 'Food', '2026-11-01'), tx('expense', 2, 'Food', '2026-11-02'), tx('expense', 3, 'Food', '2026-11-03')];
  const middle = items[1];
  assert.ok(middle);
  const { items: after, removed } = removeTransaction(items, middle.id);
  assert.deepEqual(after.map((t) => t.amount), [1, 3]);
  assert.ok(removed);
  assert.equal(removed.index, 1);
  assert.deepEqual(restoreTransaction(after, removed), items);
});

test('restoreTransaction copes with a list that changed meanwhile', () => {
  const a = tx('expense', 1, 'Food', '2026-11-01');
  const b = tx('expense', 2, 'Food', '2026-11-02');
  const { removed } = removeTransaction([a, b], b.id);
  assert.ok(removed);
  assert.deepEqual(restoreTransaction([], removed), [b]); // index past the end is clamped
  assert.deepEqual(restoreTransaction([a, b], removed), [a, b]); // already back: no duplicate
});

test('removeTransaction with an unknown id changes nothing', () => {
  const a = tx('expense', 1, 'Food', '2026-11-01');
  assert.deepEqual(removeTransaction([a], 'missing'), { items: [a], removed: null });
});
