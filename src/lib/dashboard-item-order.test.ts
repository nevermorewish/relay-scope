import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardItemId, sortDashboardItems, type SortableDashboardItem } from './dashboard-item-order';

function item(id: number, values: Partial<SortableDashboardItem> = {}): SortableDashboardItem {
  return {
    keyId: id,
    monitoredModelId: id,
    testModel: `model-${id}`,
    groupRateMultiplier: null,
    generationSuccess24h: null,
    averageLatencyMs: null,
    balance: null,
    price: null,
    ...values,
  };
}

test('sorts dashboard rows in the useful direction for each metric', () => {
  const rows = [
    item(1, { price: { inputPrice: 2, outputPrice: 4, multiplier: 0.2 }, generationSuccess24h: 90, averageLatencyMs: 500, balance: 10 }),
    item(2, { price: { inputPrice: 1, outputPrice: 3, multiplier: 0.1 }, generationSuccess24h: 99, averageLatencyMs: 200, balance: 20 }),
  ];
  assert.deepEqual(sortDashboardItems(rows, 'price').map(dashboardItemId), ['2:2', '1:1']);
  assert.deepEqual(sortDashboardItems(rows, 'success').map(dashboardItemId), ['2:2', '1:1']);
  assert.deepEqual(sortDashboardItems(rows, 'latency').map(dashboardItemId), ['2:2', '1:1']);
  assert.deepEqual(sortDashboardItems(rows, 'multiplier').map(dashboardItemId), ['2:2', '1:1']);
  assert.deepEqual(sortDashboardItems(rows, 'balance').map(dashboardItemId), ['2:2', '1:1']);
});
