import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNewApiLogPrices,
  deriveDisplayedMultiplier,
  deriveEffectiveMultiplier,
  formatMultiplier,
  hasVisibleMultiplierChange,
  maxRelativePriceChange,
  normalizeNewApiPricing,
  percentile,
} from './pricing';
import { parseNewApiCostLogItems } from './adapters/newapi';

test('normalizes New API token ratios with group multiplier', () => {
  const prices = normalizeNewApiPricing({
    data: [{ model_name: 'model-a', quota_type: 0, model_ratio: 2, completion_ratio: 3, cache_ratio: 0.25 }],
    group_ratio: { vip: 0.5 },
  }, { data: { quota_per_unit: 500000 } }, 'vip');
  assert.equal(prices[0].inputPrice, 2);
  assert.equal(prices[0].outputPrice, 6);
  assert.equal(prices[0].cacheReadPrice, 0.5);
});

test('keeps fixed-price models separate from token prices', () => {
  const prices = normalizeNewApiPricing({ data: [{ model_name: 'image-a', quota_type: 1, model_price: 0.04 }] });
  assert.equal(prices[0].fixedPrice, 0.04);
  assert.equal(prices[0].inputPrice, undefined);
});

test('calculates nearest-rank percentiles', () => {
  assert.equal(percentile([10, 20, 30, 40], 0.5), 20);
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  assert.equal(percentile([], 0.5), null);
});

test('detects the largest relative price change', () => {
  assert.ok(Math.abs((maxRelativePriceChange(
    { inputPrice: 2, outputPrice: 6 },
    { inputPrice: 2.1, outputPrice: 7.2 },
  ) ?? 0) - 0.2) < 1e-9);
});

test('derives a model-level effective multiplier from official prices', () => {
  assert.equal(deriveEffectiveMultiplier(
    { inputPrice: 0.06, outputPrice: 0.18 },
    { input: 2, output: 6 },
  ), 0.03);
});

test('derives and formats the recharge-adjusted multiplier shown on the dashboard', () => {
  assert.equal(deriveDisplayedMultiplier(
    { inputPrice: 6, outputPrice: 30 },
    { input: 3, output: 15 },
    10,
  ), 0.2);
  assert.equal(formatMultiplier(0.2), '0.20');
  assert.equal(formatMultiplier(0.0325), '0.03');
  assert.equal(hasVisibleMultiplierChange(0.0214, 0.0161), false);
  assert.equal(hasVisibleMultiplierChange(0.0128, 0.0214), true);
});

test('calculates A6 actual route prices from New API log ratios', () => {
  assert.deepEqual(calculateNewApiLogPrices({
    modelRatio: 0.0252,
    completionRatio: 6,
    cacheRatio: 0.1,
    groupRatio: 1,
    userGroupRatio: -1,
    quotaPerUnit: 500000,
  }), {
    inputPrice: 0.0504,
    outputPrice: 0.3024,
    cacheReadPrice: 0.00504,
  });
});

test('parses New API cost logs without double-counting cached input tokens', () => {
  const [entry] = parseNewApiCostLogItems([{
    id: 123,
    model_name: 'model-a',
    token_id: 7,
    token_name: 'gpt-monitor',
    prompt_tokens: 100,
    completion_tokens: 20,
    quota: 250000,
    created_at: 1784869000,
    other: JSON.stringify({ cache_tokens: 40 }),
  }], 500000);
  assert.equal(entry.id, '123');
  assert.equal(entry.inputTokens, 60);
  assert.equal(entry.cacheReadTokens, 40);
  assert.equal(entry.quota / entry.quotaPerUnit, 0.5);
});
