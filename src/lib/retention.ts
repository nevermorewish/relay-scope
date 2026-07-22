import { prisma } from './db';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let lastCleanupAt = 0;

export async function runRetentionCleanup(retentionDays: number) {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  const days = Math.max(1, Math.floor(retentionDays));
  const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
  const [usageSnapshots, priceSnapshots] = await Promise.all([
    prisma.usageSnapshot.findMany({
      orderBy: { recordedAt: 'desc' },
      select: { id: true, upstreamKeyId: true, modelName: true },
    }),
    prisma.priceSnapshot.findMany({
      orderBy: { recordedAt: 'desc' },
      select: { id: true, upstreamId: true, upstreamKeyId: true, modelName: true },
    }),
  ]);

  const latestUsageIds = newestIds(usageSnapshots, (row) => `${row.upstreamKeyId}:${row.modelName}`);
  const latestPriceIds = newestIds(
    priceSnapshots,
    (row) => `${row.upstreamId}:${row.upstreamKeyId ?? 'all'}:${row.modelName}`
  );

  await prisma.$transaction([
    prisma.metric.deleteMany({ where: { recordedAt: { lt: cutoff } } }),
    prisma.usageSnapshot.deleteMany({
      where: { recordedAt: { lt: cutoff }, id: { notIn: latestUsageIds } },
    }),
    prisma.priceSnapshot.deleteMany({
      where: { recordedAt: { lt: cutoff }, id: { notIn: latestPriceIds } },
    }),
    prisma.incident.deleteMany({ where: { resolved: true, createdAt: { lt: cutoff } } }),
  ]);
  lastCleanupAt = now;
}

function newestIds<T extends { id: number }>(rows: T[], keyOf: (row: T) => string) {
  const seen = new Set<string>();
  const ids: number[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(row.id);
  }
  return ids;
}
