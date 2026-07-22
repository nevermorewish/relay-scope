import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatePricingFromUsage } from './usage-pricing';

test('derives the configured multiplier from SUB2API actual cost deltas', () => {
  const result = estimatePricingFromUsage(
    { inputTokens: 3339, outputTokens: 144, cacheReadTokens: 23040, cacheWriteTokens: 0, actualCost: 0.00097605 },
    { inputTokens: 4452, outputTokens: 192, cacheReadTokens: 30720, cacheWriteTokens: 0, actualCost: 0.0013014 },
    { inputPrice: 5, outputPrice: 30, cacheReadPrice: 0.5 }
  );
  assert.ok(result);
  assert.ok(Math.abs(result.multiplier - 0.03) < 1e-10);
});

test('skips resets and unknown billable components', () => {
  const previous = { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, actualCost: 1 };
  assert.equal(estimatePricingFromUsage(previous, { ...previous, inputTokens: 50, actualCost: 0.5 }, { inputPrice: 1, outputPrice: 1 }), null);
  assert.equal(estimatePricingFromUsage(previous, { ...previous, cacheWriteTokens: 10, actualCost: 2 }, { inputPrice: 1, outputPrice: 1 }), null);
});
