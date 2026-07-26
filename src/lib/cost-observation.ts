import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import type { CostLogEntry, ModelTestResult, UpstreamAdapter } from './adapters/base';
import { getAdapter } from './adapters/registry';
import { tryDecrypt } from './crypto';
import { prisma } from './db';
import type { UpstreamType } from './domain-types';
import { getOfficialModelPrice } from './official-model-prices';

const LOG_PAGE_SIZE = 100;
const MAX_LOG_PAGES_PER_PASS = 20;
const LOG_OVERLAP_MS = 5 * 60 * 1000;

export interface CumulativeUsagePoint {
  id: number;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  actualCost: number;
  recordedAt: Date;
}

export function calculateCumulativeCostDelta(
  previous: CumulativeUsagePoint,
  current: CumulativeUsagePoint
) {
  const delta = {
    inputTokens: current.inputTokens - previous.inputTokens,
    outputTokens: current.outputTokens - previous.outputTokens,
    cacheReadTokens: current.cacheReadTokens - previous.cacheReadTokens,
    cacheWriteTokens: current.cacheWriteTokens - previous.cacheWriteTokens,
    costUsdCredit: current.actualCost - previous.actualCost,
  };
  if (Object.values(delta).some((value) => value < 0)) return null;
  if (delta.costUsdCredit === 0
    && delta.inputTokens === 0
    && delta.outputTokens === 0
    && delta.cacheReadTokens === 0
    && delta.cacheWriteTokens === 0) return null;
  return delta;
}

export function convertUsdCreditToCostCny(costUsdCredit: number, creditUsdPerCny: number) {
  if (!Number.isFinite(costUsdCredit) || costUsdCredit < 0
    || !Number.isFinite(creditUsdPerCny) || creditUsdPerCny <= 0) return null;
  return costUsdCredit / creditUsdPerCny;
}

export function calculateBalanceCostDelta(previousBalance: number, currentBalance: number) {
  if (!Number.isFinite(previousBalance) || !Number.isFinite(currentBalance)) return null;
  const costUsdCredit = previousBalance - currentBalance;
  return costUsdCredit > 0 ? costUsdCredit : null;
}

/**
 * 将同一站点所有分组采集到的共享账户余额按时间合并为一条序列。
 * 余额下降记为消费；余额持平或增加只更新基线，不抵消历史消费。
 */
export async function syncSiteBalanceCosts(params: {
  upstreamId: number;
  creditUsdPerCny: number;
}) {
  const state = await prisma.siteCostState.findUnique({
    where: { upstreamId: params.upstreamId },
  });
  const metrics = await prisma.metric.findMany({
    where: {
      upstreamId: params.upstreamId,
      balance: { not: null },
      ...(state ? { id: { gt: state.lastMetricId } } : {}),
    },
    orderBy: { id: 'asc' },
    select: { id: true, balance: true, recordedAt: true },
  });
  if (!metrics.length) return { created: 0 };

  let previous = state
    ? {
        id: state.lastMetricId,
        balance: state.lastBalance,
        recordedAt: state.lastProcessedAt,
      }
    : null;
  const coverageStartedAt = state?.coverageStartedAt || metrics[0].recordedAt;
  let created = 0;

  for (const metric of metrics) {
    if (metric.balance == null) continue;
    if (previous) {
      const costUsdCredit = calculateBalanceCostDelta(previous.balance, metric.balance);
      if (costUsdCredit != null) {
        const costCny = convertUsdCreditToCostCny(costUsdCredit, params.creditUsdPerCny);
        if (costCny != null) {
          const result = await prisma.siteCostRecord.upsert({
            where: {
              upstreamId_sourceRef: {
                upstreamId: params.upstreamId,
                sourceRef: `balance:${previous.id}:${metric.id}`,
              },
            },
            update: {},
            create: {
              upstreamId: params.upstreamId,
              previousMetricId: previous.id,
              currentMetricId: metric.id,
              balanceBefore: previous.balance,
              balanceAfter: metric.balance,
              costUsdCredit,
              costCny,
              creditUsdPerCny: params.creditUsdPerCny,
              sourceRef: `balance:${previous.id}:${metric.id}`,
              occurredAt: metric.recordedAt,
            },
            select: { id: true },
          });
          if (result.id) created += 1;
        }
      }
    }
    previous = { id: metric.id, balance: metric.balance, recordedAt: metric.recordedAt };
  }

  if (previous) {
    await prisma.siteCostState.upsert({
      where: { upstreamId: params.upstreamId },
      update: {
        lastMetricId: previous.id,
        lastBalance: previous.balance,
        lastProcessedAt: previous.recordedAt,
      },
      create: {
        upstreamId: params.upstreamId,
        lastMetricId: previous.id,
        lastBalance: previous.balance,
        coverageStartedAt,
        lastProcessedAt: previous.recordedAt,
      },
    });
  }
  return { created };
}

export async function syncSub2UsageCosts(params: {
  upstreamId: number;
  upstreamKeyId: number;
  creditUsdPerCny: number;
}) {
  const snapshots = await prisma.usageSnapshot.findMany({
    where: { upstreamKeyId: params.upstreamKeyId },
    orderBy: [{ modelName: 'asc' }, { recordedAt: 'asc' }, { id: 'asc' }],
  });
  const state = await prisma.costSyncState.findUnique({
    where: { upstreamKeyId: params.upstreamKeyId },
  });
  const cursors = parseCursorMap(state?.cursor);
  const grouped = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const values = grouped.get(snapshot.modelName) || [];
    values.push(snapshot);
    grouped.set(snapshot.modelName, values);
  }

  for (const [modelName, values] of Array.from(grouped.entries())) {
    const cursorId = cursors[modelName];
    const cursorIndex = cursorId == null ? -1 : values.findIndex((item) => item.id === cursorId);
    const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 1;
    for (let index = startIndex; index < values.length; index += 1) {
      const previous = values[index - 1];
      const current = values[index];
      const delta = calculateCumulativeCostDelta(previous, current);
      if (!delta) continue;
      const costCny = convertUsdCreditToCostCny(delta.costUsdCredit, params.creditUsdPerCny);
      await prisma.costRecord.upsert({
        where: {
          upstreamId_sourceRef: {
            upstreamId: params.upstreamId,
            sourceRef: `usage:${previous.id}:${current.id}`,
          },
        },
        update: {},
        create: {
          upstreamId: params.upstreamId,
          upstreamKeyId: params.upstreamKeyId,
          modelName,
          inputTokens: delta.inputTokens,
          outputTokens: delta.outputTokens,
          cacheReadTokens: delta.cacheReadTokens,
          cacheWriteTokens: delta.cacheWriteTokens,
          costUsdCredit: delta.costUsdCredit,
          costCny,
          creditUsdPerCny: params.creditUsdPerCny,
          source: 'REMOTE_USAGE',
          completeness: 'COMPLETE',
          sourceRef: `usage:${previous.id}:${current.id}`,
          occurredAt: current.recordedAt,
          rawData: { previousSnapshotId: previous.id, currentSnapshotId: current.id },
        },
      });
    }
    const latest = values.at(-1);
    if (latest) cursors[modelName] = latest.id;
  }

  const coverageStartedAt = snapshots.length
    ? new Date(Math.min(...snapshots.map((snapshot) => snapshot.recordedAt.getTime())))
    : undefined;
  await prisma.costSyncState.upsert({
    where: { upstreamKeyId: params.upstreamKeyId },
    update: {
      mode: 'REMOTE_USAGE',
      coverageStartedAt,
      cursor: JSON.stringify(cursors),
      lastSyncedAt: new Date(),
      lastError: null,
    },
    create: {
      upstreamKeyId: params.upstreamKeyId,
      mode: 'REMOTE_USAGE',
      coverageStartedAt,
      cursor: JSON.stringify(cursors),
      lastSyncedAt: new Date(),
    },
  });
}

export async function markLocalCostMode(upstreamKeyId: number, coverageStartedAt: Date) {
  await prisma.costSyncState.upsert({
    where: { upstreamKeyId },
    update: { mode: 'LOCAL_PROBE', coverageStartedAt, lastError: null },
    create: { upstreamKeyId, mode: 'LOCAL_PROBE', coverageStartedAt },
  });
}

export async function recordLocalProbeCost(params: {
  upstreamId: number;
  upstreamKeyId: number;
  metricId: number;
  modelName: string;
  result: ModelTestResult;
  creditUsdPerCny: number;
  groupRateMultiplier: number | null;
  occurredAt: Date;
}) {
  if (!params.result.ok || !params.result.usage) return;
  const price = await resolveLocalPrice(params);
  const usage = params.result.usage;
  const monetary = price ? calculateTokenCost(usage, price) : null;
  await prisma.costRecord.upsert({
    where: {
      upstreamId_sourceRef: {
        upstreamId: params.upstreamId,
        sourceRef: `local-probe:${params.metricId}`,
      },
    },
    update: {},
    create: {
      upstreamId: params.upstreamId,
      upstreamKeyId: params.upstreamKeyId,
      modelName: params.modelName,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      costUsdCredit: monetary?.costUsdCredit,
      costCny: monetary?.costCny,
      creditUsdPerCny: params.creditUsdPerCny,
      source: 'LOCAL_PROBE',
      completeness: price ? 'PARTIAL' : 'UNPRICED',
      estimated: usage.estimated,
      sourceRef: `local-probe:${params.metricId}`,
      occurredAt: params.occurredAt,
      rawData: price ? { priceSource: price.source } : { priceSource: 'MISSING' },
    },
  });
}

export async function syncNewApiCostsForUpstreams(
  upstreams: Array<{
    id: number;
    baseUrl: string;
    type: string;
    creditUsdPerCny: number;
    keys: Array<{
      id: number;
      createdAt: Date;
      apiKeyEnc: string | null;
      accessTokenEnc: string | null;
      userId: string | null;
      remoteKeyId: string | null;
      keyName: string | null;
      group: string;
    }>;
  }>
) {
  for (const upstream of upstreams) {
    if (upstream.type !== 'NEW_API') continue;
    const credentialGroups = new Map<string, typeof upstream.keys>();
    for (const key of upstream.keys) {
      const accessToken = key.accessTokenEnc ? tryDecrypt(key.accessTokenEnc) : null;
      if (!accessToken || !key.userId) {
        await setSyncError(key.id, 'REMOTE_LOG', '未配置 Access Token 或用户 ID');
        continue;
      }
      const fingerprint = createHash('sha256')
        .update(`${accessToken}\0${key.userId}`)
        .digest('hex');
      const values = credentialGroups.get(fingerprint) || [];
      values.push(key);
      credentialGroups.set(fingerprint, values);
    }
    for (const keys of Array.from(credentialGroups.values())) {
      await syncNewApiCredentialGroup(upstream, keys).catch(async (error) => {
        const message = error instanceof Error ? error.message : String(error);
        await Promise.all(keys.map((key) => setSyncError(key.id, 'REMOTE_LOG', message)));
      });
    }
  }
}

async function syncNewApiCredentialGroup(
  upstream: Parameters<typeof syncNewApiCostsForUpstreams>[0][number],
  keys: Parameters<typeof syncNewApiCostsForUpstreams>[0][number]['keys']
) {
  const first = keys[0];
  const accessToken = first.accessTokenEnc ? tryDecrypt(first.accessTokenEnc) : null;
  if (!accessToken || !first.userId) return;
  const adapter = getAdapter('NEW_API') as UpstreamAdapter;
  if (!adapter.queryCostLogs) return;
  const states = await prisma.costSyncState.findMany({
    where: { upstreamKeyId: { in: keys.map((key) => key.id) } },
  });
  const latestSync = states.reduce<Date | null>((latest, state) => (
    !state.lastSyncedAt || (latest && state.lastSyncedAt < latest) ? latest : state.lastSyncedAt
  ), null);
  const minimumCreatedAt = new Date(Math.min(...keys.map((key) => key.createdAt.getTime())));
  const now = new Date();
  const representativeCursor = parseLogCursor(states[0]?.cursor);
  const backfillEnd = representativeCursor.backfillDone
    ? null
    : new Date(representativeCursor.backfillBefore || now);
  const intervals: Array<{ startTime: Date; endTime: Date; backfill: boolean }> = [];
  if (latestSync) {
    intervals.push({
      startTime: new Date(Math.max(minimumCreatedAt.getTime(), latestSync.getTime() - LOG_OVERLAP_MS)),
      endTime: now,
      backfill: false,
    });
  }
  if (backfillEnd) {
    intervals.push({ startTime: minimumCreatedAt, endTime: backfillEnd, backfill: true });
  }
  if (!intervals.length) {
    intervals.push({ startTime: minimumCreatedAt, endTime: now, backfill: true });
  }

  let unmatched = 0;
  let backfillCursor = representativeCursor;
  for (const interval of intervals) {
    const result = await fetchLogInterval(adapter, {
      baseUrl: upstream.baseUrl,
      apiKey: '',
      accessToken,
      userId: first.userId,
      timeoutMs: 30000,
      testModel: '',
    }, interval);
    if (!result.ok) {
      if (result.supported === false) {
        await Promise.all(keys.map((key) => markLocalCostMode(key.id, key.createdAt)));
        return;
      }
      throw new Error(result.errorMessage || '消费日志同步失败');
    }
    let oldest: Date | null = null;
    for (const entry of result.entries) {
      const key = matchCostLogKey(entry, keys);
      if (!key || entry.occurredAt < key.createdAt) {
        unmatched += 1;
        continue;
      }
      await writeNewApiCost(upstream, key.id, entry);
      if (!oldest || entry.occurredAt < oldest) oldest = entry.occurredAt;
    }
    if (interval.backfill) {
      backfillCursor = result.hasMore && oldest
        ? { backfillDone: false, backfillBefore: oldest.getTime() - 1000 }
        : { backfillDone: true };
    }
  }

  const records = await prisma.costRecord.groupBy({
    by: ['upstreamKeyId'],
    where: { upstreamKeyId: { in: keys.map((key) => key.id) }, source: 'REMOTE_LOG' },
    _min: { occurredAt: true },
  });
  const coverageByKey = new Map(records.map((row) => [row.upstreamKeyId, row._min.occurredAt]));
  await Promise.all(keys.map((key) => prisma.costSyncState.upsert({
    where: { upstreamKeyId: key.id },
    update: {
      mode: 'REMOTE_LOG',
      coverageStartedAt: backfillCursor.backfillDone
        ? key.createdAt
        : coverageByKey.get(key.id) || null,
      cursor: JSON.stringify(backfillCursor),
      lastSyncedAt: now,
      lastError: unmatched ? `${unmatched} 条日志无法唯一映射到分组` : null,
    },
    create: {
      upstreamKeyId: key.id,
      mode: 'REMOTE_LOG',
      coverageStartedAt: backfillCursor.backfillDone
        ? key.createdAt
        : coverageByKey.get(key.id) || null,
      cursor: JSON.stringify(backfillCursor),
      lastSyncedAt: now,
      lastError: unmatched ? `${unmatched} 条日志无法唯一映射到分组` : null,
    },
  })));
}

async function fetchLogInterval(
  adapter: UpstreamAdapter,
  context: Parameters<NonNullable<UpstreamAdapter['queryCostLogs']>>[0],
  interval: { startTime: Date; endTime: Date }
) {
  const entries: CostLogEntry[] = [];
  let page = 1;
  let hasMore = false;
  do {
    const result = await adapter.queryCostLogs!(context, {
      page,
      pageSize: LOG_PAGE_SIZE,
      startTime: interval.startTime,
      endTime: interval.endTime,
    });
    if (!result.ok) return { ...result, entries, hasMore: false };
    entries.push(...(result.entries || []));
    hasMore = Boolean(result.hasMore);
    page += 1;
  } while (hasMore && page <= MAX_LOG_PAGES_PER_PASS);
  return { ok: true, supported: true, entries, hasMore };
}

export function matchCostLogKey<T extends {
  id: number;
  remoteKeyId: string | null;
  keyName: string | null;
}>(entry: Pick<CostLogEntry, 'remoteKeyId' | 'keyName'>, keys: T[]) {
  if (entry.remoteKeyId) {
    const exact = keys.find((key) => key.remoteKeyId === entry.remoteKeyId);
    if (exact) return exact;
  }
  if (!entry.keyName) return null;
  const named = keys.filter((key) => key.keyName === entry.keyName);
  return named.length === 1 ? named[0] : null;
}

async function writeNewApiCost(
  upstream: { id: number; creditUsdPerCny: number },
  upstreamKeyId: number,
  entry: CostLogEntry
) {
  const costUsdCredit = entry.quota / entry.quotaPerUnit;
  const costCny = convertUsdCreditToCostCny(costUsdCredit, upstream.creditUsdPerCny);
  await prisma.costRecord.upsert({
    where: {
      upstreamId_sourceRef: {
        upstreamId: upstream.id,
        sourceRef: `newapi-log:${entry.id}`,
      },
    },
    update: {},
    create: {
      upstreamId: upstream.id,
      upstreamKeyId,
      modelName: entry.modelName,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      cacheReadTokens: entry.cacheReadTokens,
      cacheWriteTokens: entry.cacheWriteTokens,
      costUsdCredit,
      costCny,
      creditUsdPerCny: upstream.creditUsdPerCny,
      source: 'REMOTE_LOG',
      completeness: 'COMPLETE',
      sourceRef: `newapi-log:${entry.id}`,
      occurredAt: entry.occurredAt,
      rawData: entry.rawData as Prisma.InputJsonValue | undefined,
    },
  });
}

async function resolveLocalPrice(params: {
  upstreamId: number;
  upstreamKeyId: number;
  modelName: string;
  creditUsdPerCny: number;
  groupRateMultiplier: number | null;
}) {
  const snapshot = await prisma.priceSnapshot.findFirst({
    where: {
      upstreamId: params.upstreamId,
      modelName: params.modelName,
      OR: [{ upstreamKeyId: params.upstreamKeyId }, { upstreamKeyId: null }],
    },
    orderBy: { recordedAt: 'desc' },
  });
  if (snapshot && (snapshot.inputPrice != null || snapshot.outputPrice != null)) {
    return {
      inputPrice: snapshot.inputPrice,
      outputPrice: snapshot.outputPrice,
      cacheReadPrice: snapshot.cacheReadPrice,
      cacheWritePrice: snapshot.cacheWritePrice,
      currency: snapshot.currency,
      source: snapshot.source,
      creditUsdPerCny: params.creditUsdPerCny,
    };
  }
  const official = getOfficialModelPrice(params.modelName);
  if (
    !official ||
    official.input == null ||
    official.output == null ||
    !params.groupRateMultiplier ||
    params.groupRateMultiplier <= 0
  ) {
    return null;
  }
  return {
    inputPrice: official.input * params.groupRateMultiplier,
    outputPrice: official.output * params.groupRateMultiplier,
    cacheReadPrice: null,
    cacheWritePrice: null,
    currency: 'USD',
    source: 'CALCULATED',
    creditUsdPerCny: params.creditUsdPerCny,
  };
}

export function calculateTokenCost(
  usage: NonNullable<ModelTestResult['usage']>,
  price: {
    inputPrice: number | null;
    outputPrice: number | null;
    cacheReadPrice: number | null;
    cacheWritePrice: number | null;
    currency: string;
    creditUsdPerCny: number;
  }
) {
  const components: Array<[number, number | null]> = [
    [usage.inputTokens, price.inputPrice],
    [usage.outputTokens, price.outputPrice],
    [usage.cacheReadTokens, price.cacheReadPrice],
    [usage.cacheWriteTokens, price.cacheWritePrice],
  ];
  if (components.some(([tokens, amount]) => tokens > 0 && amount == null)) return null;
  const amount = components.reduce((sum, [tokens, componentPrice]) => (
    sum + tokens * (componentPrice || 0) / 1_000_000
  ), 0);
  if (price.currency === 'CNY') {
    return { costCny: amount, costUsdCredit: amount * price.creditUsdPerCny };
  }
  return {
    costUsdCredit: amount,
    costCny: convertUsdCreditToCostCny(amount, price.creditUsdPerCny),
  };
}

async function setSyncError(upstreamKeyId: number, mode: string, message: string) {
  await prisma.costSyncState.upsert({
    where: { upstreamKeyId },
    update: { mode, lastError: message },
    create: { upstreamKeyId, mode, lastError: message },
  });
}

function parseCursorMap(value?: string | null): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, number>
      : {};
  } catch {
    return {};
  }
}

function parseLogCursor(value?: string | null): { backfillDone: boolean; backfillBefore?: number } {
  if (!value) return { backfillDone: false };
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      backfillDone: parsed.backfillDone === true,
      backfillBefore: typeof parsed.backfillBefore === 'number' ? parsed.backfillBefore : undefined,
    };
  } catch {
    return { backfillDone: false };
  }
}

export function adapterHasRemoteCostSource(type: UpstreamType) {
  return type === 'SUB2API' || type === 'NEW_API';
}
