import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseCostTrendGranularity,
  localRangeBoundaries,
  summarizeCostRecords,
  summarizeSiteCostRecords,
  type CostSummaryRecord,
} from './cost-summary';

const records: CostSummaryRecord[] = [
  {
    upstreamId: 1,
    upstreamName: 'site-a',
    upstreamKeyId: 10,
    group: 'gpt',
    groupLabel: null,
    modelName: 'model-a',
    inputTokens: 100,
    outputTokens: 20,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsdCredit: 2,
    costCny: 1,
    source: 'REMOTE_USAGE',
    completeness: 'COMPLETE',
    estimated: false,
    occurredAt: new Date('2026-07-01T16:30:00Z'),
  },
  {
    upstreamId: 1,
    upstreamName: 'site-a',
    upstreamKeyId: 10,
    group: 'gpt',
    groupLabel: null,
    modelName: 'model-b',
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsdCredit: null,
    costCny: null,
    source: 'LOCAL_PROBE',
    completeness: 'UNPRICED',
    estimated: true,
    occurredAt: new Date('2026-07-02T00:30:00Z'),
  },
];

test('aggregates costs into site, group, model and local calendar day', () => {
  const result = summarizeCostRecords(records, -480);
  assert.equal(result.totals.costCny, 1);
  assert.equal(result.totals.totalTokens, 135);
  assert.equal(result.totals.unpricedTokens, 15);
  assert.equal(result.breakdown[0].groups[0].models.length, 2);
  assert.deepEqual(result.trend.map((item) => item.date), ['2026-07-02']);
});

test('derives local today, month, and rolling 30-day boundaries from browser timezone offset', () => {
  const result = localRangeBoundaries(new Date('2026-07-24T06:00:00Z'), -480);
  assert.equal(result.today.toISOString(), '2026-07-23T16:00:00.000Z');
  assert.equal(result.month.toISOString(), '2026-06-30T16:00:00.000Z');
  assert.equal(result.last30Days.toISOString(), '2026-06-24T16:00:00.000Z');
});

test('aggregates authoritative site costs separately from attribution records', () => {
  const result = summarizeSiteCostRecords([
    {
      upstreamId: 1,
      upstreamName: 'site-a',
      costUsdCredit: 3,
      costCny: 1.5,
      occurredAt: new Date('2026-07-02T01:00:00Z'),
    },
    {
      upstreamId: 2,
      upstreamName: 'site-b',
      costUsdCredit: 4,
      costCny: 2,
      occurredAt: new Date('2026-07-02T02:00:00Z'),
    },
  ], -480);
  assert.equal(result.totals.costCny, 3.5);
  assert.equal(result.sites[0].upstreamName, 'site-b');
  assert.equal(result.trend[0].bucketStart, '2026-07-02T01:00:00.000Z');
});

test('chooses useful trend granularity for common ranges', () => {
  const start = new Date('2026-07-01T00:00:00Z');
  assert.equal(chooseCostTrendGranularity(start, new Date('2026-07-02T00:00:00Z')), '15m');
  assert.equal(chooseCostTrendGranularity(start, new Date('2026-07-08T00:00:00Z')), '6h');
  assert.equal(chooseCostTrendGranularity(start, new Date('2026-07-31T00:00:00Z')), 'day');
  assert.equal(chooseCostTrendGranularity(start, new Date('2027-01-01T00:00:00Z')), 'week');
});

test('fills empty 15-minute buckets in the selected range', () => {
  const result = summarizeSiteCostRecords([{
    upstreamId: 1,
    upstreamName: 'site-a',
    costUsdCredit: 1,
    costCny: 0.5,
    occurredAt: new Date('2026-07-02T00:20:00Z'),
  }], 0, {
    from: new Date('2026-07-02T00:00:00Z'),
    to: new Date('2026-07-02T01:00:00Z'),
  });
  assert.equal(result.trendGranularity, '15m');
  assert.deepEqual(result.trend.map((item) => item.costCny), [0, 0.5, 0, 0]);
});
