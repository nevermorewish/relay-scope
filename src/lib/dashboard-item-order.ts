export type DashboardSortMode = 'default' | 'price' | 'success' | 'latency' | 'multiplier' | 'balance';

export interface SortableDashboardItem {
  keyId: number;
  monitoredModelId: number | null;
  testModel: string | null;
  groupRateMultiplier: number | null;
  generationSuccess24h: number | null;
  averageLatencyMs: number | null;
  balance: number | null;
  price: { inputPrice: number | null; outputPrice: number | null; multiplier: number | null } | null;
}

export function dashboardItemId(item: Pick<SortableDashboardItem, 'keyId' | 'monitoredModelId' | 'testModel'>) {
  return `${item.keyId}:${item.monitoredModelId ?? item.testModel ?? 'none'}`;
}

export function sortDashboardItems<T extends SortableDashboardItem>(
  items: T[],
  mode: DashboardSortMode,
): T[] {
  const originalIndex = new Map(items.map((item, index) => [dashboardItemId(item), index]));
  return [...items].sort((left, right) => {
    let comparison = 0;
    if (mode === 'price') {
      comparison = ascending(priceValue(left), priceValue(right));
    } else if (mode === 'success') {
      comparison = descending(left.generationSuccess24h, right.generationSuccess24h);
    } else if (mode === 'latency') {
      comparison = ascending(left.averageLatencyMs, right.averageLatencyMs);
    } else if (mode === 'multiplier') {
      comparison = ascending(
        left.price?.multiplier ?? left.groupRateMultiplier,
        right.price?.multiplier ?? right.groupRateMultiplier,
      );
    } else if (mode === 'balance') {
      comparison = descending(left.balance, right.balance);
    }
    return comparison || (originalIndex.get(dashboardItemId(left)) ?? 0) - (originalIndex.get(dashboardItemId(right)) ?? 0);
  });
}

export function applyDashboardItemOrder<T extends SortableDashboardItem>(
  items: T[],
  orderedIds: string[],
): T[] {
  if (orderedIds.length === 0) return [...items];
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  const fallback = new Map(items.map((item, index) => [dashboardItemId(item), index]));
  return [...items].sort((left, right) => {
    const leftOrder = order.get(dashboardItemId(left));
    const rightOrder = order.get(dashboardItemId(right));
    if (leftOrder == null) return rightOrder == null ? (fallback.get(dashboardItemId(left)) ?? 0) - (fallback.get(dashboardItemId(right)) ?? 0) : 1;
    if (rightOrder == null) return -1;
    return leftOrder - rightOrder;
  });
}

export function moveDashboardItem(orderedIds: string[], draggedId: string, targetId: string): string[] {
  if (draggedId === targetId) return orderedIds;
  const from = orderedIds.indexOf(draggedId);
  const to = orderedIds.indexOf(targetId);
  if (from < 0 || to < 0) return orderedIds;
  const next = [...orderedIds];
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
}

function priceValue(item: SortableDashboardItem) {
  return item.price?.inputPrice ?? item.price?.outputPrice ?? null;
}

function ascending(left: number | null, right: number | null) {
  if (left == null) return right == null ? 0 : 1;
  if (right == null) return -1;
  return left - right;
}

function descending(left: number | null, right: number | null) {
  if (left == null) return right == null ? 0 : 1;
  if (right == null) return -1;
  return right - left;
}
