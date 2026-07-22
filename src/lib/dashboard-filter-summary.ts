export interface DashboardSummaryItem {
  upstreamId: number;
  upstreamStatus: string;
  keyId: number;
  balance: number | null;
  openIncidents: number;
  resolvedIncidents: number;
  upstreamOpenIncidents: number;
  upstreamResolvedIncidents: number;
  lightSuccessCount24h: number;
  lightSampleCount24h: number;
}

export function calculateDashboardFilterSummary(
  items: readonly DashboardSummaryItem[],
  keyScopedIncidents: boolean,
) {
  const sites = uniqueBy(items, (item) => item.upstreamId);
  const keys = uniqueBy(items, (item) => item.keyId);
  const successCount = keys.reduce((sum, item) => sum + item.lightSuccessCount24h, 0);
  const sampleCount = keys.reduce((sum, item) => sum + item.lightSampleCount24h, 0);
  const incidentRows = keyScopedIncidents ? keys : sites;

  return {
    total: sites.length,
    totalKeys: keys.length,
    online: sites.filter((item) => item.upstreamStatus === 'ONLINE').length,
    degraded: sites.filter((item) => item.upstreamStatus === 'DEGRADED').length,
    offline: sites.filter((item) => item.upstreamStatus === 'OFFLINE').length,
    totalBalance: sites.reduce((sum, item) => sum + (item.balance ?? 0), 0),
    availability: sampleCount > 0 ? Math.round(successCount / sampleCount * 1000) / 10 : 100,
    openIncidents: incidentRows.reduce(
      (sum, item) => sum + (keyScopedIncidents ? item.openIncidents : item.upstreamOpenIncidents),
      0,
    ),
    resolvedIncidents: incidentRows.reduce(
      (sum, item) => sum + (keyScopedIncidents ? item.resolvedIncidents : item.upstreamResolvedIncidents),
      0,
    ),
  };
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => number) {
  const seen = new Set<number>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
