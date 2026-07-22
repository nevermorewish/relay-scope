import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNewApiPricing, percentile } from './pricing';

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
