import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCumulativeCostDelta,
  calculateBalanceCostDelta,
  calculateTokenCost,
  convertUsdCreditToCostCny,
  matchCostLogKey,
} from './cost-observation';

const previous = {
  id: 1,
  modelName: 'model-a',
  inputTokens: 100,
  outputTokens: 20,
  cacheReadTokens: 10,
  cacheWriteTokens: 0,
  actualCost: 1,
  recordedAt: new Date('2026-07-01T00:00:00Z'),
};

test('calculates non-negative cumulative usage deltas and rejects resets', () => {
  assert.deepEqual(calculateCumulativeCostDelta(previous, {
    ...previous,
    id: 2,
    inputTokens: 160,
    outputTokens: 30,
    cacheReadTokens: 25,
    actualCost: 1.5,
  }), {
    inputTokens: 60,
    outputTokens: 10,
    cacheReadTokens: 15,
    cacheWriteTokens: 0,
    costUsdCredit: 0.5,
  });
  assert.equal(calculateCumulativeCostDelta(previous, {
    ...previous,
    id: 3,
    inputTokens: 10,
    actualCost: 0.2,
  }), null);
});

test('converts USD credit to actual CNY and rejects invalid rates', () => {
  assert.equal(convertUsdCreditToCostCny(10, 5), 2);
  assert.equal(convertUsdCreditToCostCny(10, 0), null);
});

test('counts only balance decreases as site consumption', () => {
  assert.equal(calculateBalanceCostDelta(10, 9.25), 0.75);
  assert.equal(calculateBalanceCostDelta(9.25, 19.25), null);
  assert.equal(calculateBalanceCostDelta(19.25, 19.25), null);
});

test('calculates local probe prices and requires all used price components', () => {
  const usage = {
    inputTokens: 1_000_000,
    outputTokens: 500_000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimated: false,
  };
  assert.deepEqual(calculateTokenCost(usage, {
    inputPrice: 2,
    outputPrice: 4,
    cacheReadPrice: null,
    cacheWritePrice: null,
    currency: 'USD',
    creditUsdPerCny: 2,
  }), { costUsdCredit: 4, costCny: 2 });
  assert.equal(calculateTokenCost({ ...usage, cacheReadTokens: 10 }, {
    inputPrice: 2,
    outputPrice: 4,
    cacheReadPrice: null,
    cacheWritePrice: null,
    currency: 'USD',
    creditUsdPerCny: 2,
  }), null);
});

test('maps New API logs by remote token id before unique token name', () => {
  const keys = [
    { id: 1, remoteKeyId: '101', keyName: 'shared' },
    { id: 2, remoteKeyId: '102', keyName: 'shared' },
    { id: 3, remoteKeyId: null, keyName: 'unique' },
  ];
  assert.equal(matchCostLogKey({ remoteKeyId: '102', keyName: 'shared' }, keys)?.id, 2);
  assert.equal(matchCostLogKey({ keyName: 'unique' }, keys)?.id, 3);
  assert.equal(matchCostLogKey({ keyName: 'shared' }, keys), null);
});
