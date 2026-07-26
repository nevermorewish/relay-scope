import assert from 'node:assert/strict';
import test from 'node:test';
import { alertOperatorLabel, compareAlertValue } from './alert-rule-semantics';

test('evaluates all supported alert comparison operators at the boundary', () => {
  assert.equal(compareAlertValue(10, 'lt', 10), false);
  assert.equal(compareAlertValue(10, 'lte', 10), true);
  assert.equal(compareAlertValue(10, 'gt', 10), false);
  assert.equal(compareAlertValue(10, 'gte', 10), true);
});

test('rejects unknown alert comparison operators safely', () => {
  assert.equal(compareAlertValue(10, 'equals', 10), false);
  assert.equal(alertOperatorLabel('equals'), '达到');
});
