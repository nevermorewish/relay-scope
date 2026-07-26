export type AggregatedUpstreamStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

export function aggregateUpstreamStatus(statuses: readonly string[]): AggregatedUpstreamStatus {
  if (statuses.length === 0) return 'UNKNOWN';
  if (statuses.some((status) => status === 'ONLINE')) return 'ONLINE';
  if (statuses.some((status) => status === 'DEGRADED')) return 'DEGRADED';
  if (statuses.some((status) => status === 'OFFLINE')) return 'OFFLINE';
  return 'UNKNOWN';
}
