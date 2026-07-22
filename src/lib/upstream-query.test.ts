import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSharedBalance, calculateTotalBalance, convertUsdCreditToCny } from './upstream-query';

test('uses the latest shared account balance instead of adding group balances', () => {
  const keys = [
    { lastBalance: 10, lastCollectedAt: '2026-07-22T10:00:00.000Z' },
    { lastBalance: 9.5, lastCollectedAt: '2026-07-22T10:01:00.000Z' },
  ];

  assert.equal(calculateSharedBalance(keys), 9.5);
  assert.equal(calculateTotalBalance(keys), 9.5);
});

test('returns no shared balance when the site has not reported one', () => {
  assert.equal(calculateSharedBalance([{ lastBalance: null }]), null);
  assert.equal(calculateTotalBalance([{ lastBalance: null }]), 0);
});

test('converts a site USD credit balance to the CNY amount paid', () => {
  assert.equal(convertUsdCreditToCny(100, 10), 10);
  assert.equal(convertUsdCreditToCny(100, 1), 100);
  assert.equal(convertUsdCreditToCny(100, 0), null);
});
