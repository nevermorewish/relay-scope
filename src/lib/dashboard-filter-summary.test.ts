import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDashboardFilterSummary, type DashboardSummaryItem } from './dashboard-filter-summary';

function item(patch: Partial<DashboardSummaryItem>): DashboardSummaryItem {
  return {
    upstreamId: 1,
    upstreamStatus: 'ONLINE',
    keyId: 1,
    balance: 10,
    openIncidents: 1,
    resolvedIncidents: 2,
    upstreamOpenIncidents: 3,
    upstreamResolvedIncidents: 4,
    lightSuccessCount24h: 9,
    lightSampleCount24h: 10,
    ...patch,
  };
}

test('deduplicates balances, groups, availability, and site incidents across models', () => {
  const rows = [item({}), item({})];
  const summary = calculateDashboardFilterSummary(rows, false);

  assert.equal(summary.total, 1);
  assert.equal(summary.totalKeys, 1);
  assert.equal(summary.totalBalance, 10);
  assert.equal(summary.availability, 90);
  assert.equal(summary.openIncidents, 3);
  assert.equal(summary.resolvedIncidents, 4);
});

test('uses only matching key incidents after group or model filtering', () => {
  const rows = [
    item({ keyId: 1, openIncidents: 1, resolvedIncidents: 2 }),
    item({ keyId: 2, openIncidents: 3, resolvedIncidents: 5 }),
  ];
  const summary = calculateDashboardFilterSummary(rows, true);

  assert.equal(summary.openIncidents, 4);
  assert.equal(summary.resolvedIncidents, 7);
});
