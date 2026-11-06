import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centsToDecimal, formatCents, parseAmount } from './money.ts';

test('parseAmount reads common ways of typing money', () => {
  const cases: Array<[string, number]> = [
    ['12', 1200],
    ['12.5', 1250],
    ['12.05', 1205],
    ['12,50', 1250],
    ['  7.99 ', 799],
    ['$1,250.00', 125000],
    ['1,250', 125000],
    ['1 250', 125000],
    ['€3', 300],
    ['0.01', 1],
  ];
  for (const [input, cents] of cases) {
    assert.equal(parseAmount(input), cents, input);
  }
});

test('parseAmount rejects nonsense, zero, negatives and extra decimals', () => {
  for (const input of ['', 'abc', '0', '0.00', '-5', '1.234', '1.2.3', '1e5', '12.', '.5']) {
    assert.equal(parseAmount(input), null, input);
  }
});

test('adding cents is exact where floats are not', () => {
  const a = parseAmount('0.1');
  const b = parseAmount('0.2');
  assert.ok(a !== null && b !== null);
  assert.equal(a + b, parseAmount('0.3'));
});

test('centsToDecimal', () => {
  assert.equal(centsToDecimal(0), '0.00');
  assert.equal(centsToDecimal(5), '0.05');
  assert.equal(centsToDecimal(123456), '1234.56');
  assert.equal(centsToDecimal(-1999), '-19.99');
});

test('formatCents uses the currency and locale given', () => {
  assert.equal(formatCents(123456, 'USD', 'en-US'), '$1,234.56');
  assert.equal(formatCents(-500, 'USD', 'en-US'), '-$5.00');
});
