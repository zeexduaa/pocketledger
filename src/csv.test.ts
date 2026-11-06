import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvField, toCsv } from './csv.ts';
import type { Transaction } from './ledger.ts';

test('csvField quotes only when needed', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('two\nlines'), '"two\nlines"');
});

test('csvField defuses spreadsheet formulas', () => {
  assert.equal(csvField('=SUM(A1:A9)'), "'=SUM(A1:A9)");
  assert.equal(csvField('+1'), "'+1");
  assert.equal(csvField('@cmd'), "'@cmd");
  assert.equal(csvField('-2,3'), `"'-2,3"`);
});

test('toCsv writes a header and signed amounts, newest first', () => {
  const items: Transaction[] = [
    { id: '1', kind: 'expense', amount: 1250, category: 'Food', date: '2026-11-01', note: 'lunch, with Sam' },
    { id: '2', kind: 'income', amount: 300000, category: 'Salary', date: '2026-11-05', note: '' },
  ];
  assert.equal(
    toCsv(items),
    'date,type,category,amount,note\r\n' +
      '2026-11-05,income,Salary,3000.00,\r\n' +
      '2026-11-01,expense,Food,-12.50,"lunch, with Sam"\r\n',
  );
});

test('toCsv of nothing is just the header', () => {
  assert.equal(toCsv([]), 'date,type,category,amount,note\r\n');
});
