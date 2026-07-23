import type { UpstreamKey } from '@prisma/client';

export function combineCollectionAndModelStatus(
  collectionStatus: UpstreamKey['status'],
  latestModelResults: Array<boolean | null>,
): UpstreamKey['status'] {
  if (collectionStatus === 'OFFLINE') return 'OFFLINE';
  if (latestModelResults.some((result) => result === false)) return 'DEGRADED';
  return collectionStatus;
}
