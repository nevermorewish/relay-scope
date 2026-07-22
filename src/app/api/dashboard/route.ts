import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateSharedBalance, convertUsdCreditToCny } from '@/lib/upstream-query';
import { calculateEffectivePrice } from '@/lib/official-model-prices';

export const dynamic = 'force-dynamic';

/**
 * Dashboard 概览数据
 * 统计从 keys 聚合，列表按 key（分组）粒度展开
 */
export async function GET() {
  const upstreams = await prisma.upstream.findMany({
    orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    include: {
      keys: {
        where: { enabled: true },
        orderBy: { id: 'asc' },
        include: {
          monitoredModels: { where: { enabled: true }, orderBy: { id: 'asc' } },
        },
      },
    },
  });

  const total = upstreams.length;
  const online = upstreams.filter((u) => u.status === 'ONLINE').length;
  const degraded = upstreams.filter((u) => u.status === 'DEGRADED').length;
  const offline = upstreams.filter((u) => u.status === 'OFFLINE').length;

  // 同站点分组共享账户余额：每个站点只计一次，再汇总站点余额。
  const allKeys = upstreams.flatMap((u) => u.keys);
  const sharedBalances = new Map(
    upstreams.map((upstream) => [upstream.id, calculateSharedBalance(upstream.keys)])
  );
  const totalBalance = upstreams.reduce<number>((sum, upstream) => (
    sum + (convertUsdCreditToCny(sharedBalances.get(upstream.id), upstream.creditUsdPerCny) ?? 0)
  ), 0);

  // 最近 24 小时指标一次性加载，避免按行查询。
  const oneDayAgo = new Date(Date.now() - 86400000);
  const keyIds = allKeys.map((key) => key.id);
  const [metrics, priceSnapshots, incidentCounts] = await Promise.all([
    prisma.metric.findMany({ where: { upstreamKeyId: { in: keyIds }, recordedAt: { gte: oneDayAgo } }, orderBy: { recordedAt: 'asc' } }),
    prisma.priceSnapshot.findMany({ where: { upstreamKeyId: { in: keyIds } }, orderBy: { recordedAt: 'desc' } }),
    prisma.incident.groupBy({
      by: ['upstreamId', 'upstreamKeyId', 'resolved'],
      _count: { _all: true },
    }),
  ]);
  const metricsByKey = new Map<number, typeof metrics>();
  for (const metric of metrics) {
    const values = metricsByKey.get(metric.upstreamKeyId) || [];
    values.push(metric);
    metricsByKey.set(metric.upstreamKeyId, values);
  }
  const latestPrice = new Map<string, (typeof priceSnapshots)[number]>();
  for (const price of priceSnapshots) {
    const key = price.upstreamKeyId
      ? `key:${price.upstreamKeyId}:${price.modelName}`
      : `upstream:${price.upstreamId}:${price.modelName}`;
    if (!latestPrice.has(key)) latestPrice.set(key, price);
  }
  const lightMetrics = metrics.filter((metric) => metric.probeMode === 'LIGHT');
  const totalCount = lightMetrics.length;
  const successCount = lightMetrics.filter((metric) => metric.success).length;
  const availability = totalCount > 0 ? (successCount / totalCount) * 100 : 100;

  const upstreamIncidentCounts = new Map<number, { open: number; resolved: number }>();
  const keyIncidentCounts = new Map<number, { open: number; resolved: number }>();
  for (const row of incidentCounts) {
    const field = row.resolved ? 'resolved' : 'open';
    const upstreamCount = upstreamIncidentCounts.get(row.upstreamId) || { open: 0, resolved: 0 };
    upstreamCount[field] += row._count._all;
    upstreamIncidentCounts.set(row.upstreamId, upstreamCount);
    if (row.upstreamKeyId != null) {
      const keyCount = keyIncidentCounts.get(row.upstreamKeyId) || { open: 0, resolved: 0 };
      keyCount[field] += row._count._all;
      keyIncidentCounts.set(row.upstreamKeyId, keyCount);
    }
  }
  const openIncidents = Array.from(upstreamIncidentCounts.values()).reduce((sum, count) => sum + count.open, 0);
  const resolvedIncidents = Array.from(upstreamIncidentCounts.values()).reduce((sum, count) => sum + count.resolved, 0);

  // 按分组 + 监测模型粒度展开列表。
  const list = [];
  for (const u of upstreams) {
    for (const k of u.keys) {
      const keyMetrics = metricsByKey.get(k.id) || [];
      const keyLightMetrics = keyMetrics.filter((metric) => metric.probeMode === 'LIGHT');
      const upstreamAlerts = upstreamIncidentCounts.get(u.id) || { open: 0, resolved: 0 };
      const keyAlerts = keyIncidentCounts.get(k.id) || { open: 0, resolved: 0 };
      const fallbackName = k.testModel;
      const models = k.monitoredModels.length
        ? k.monitoredModels
        : fallbackName
          ? [{ id: 0, modelName: fallbackName, officialInputPrice: null, officialOutputPrice: null }]
          : [];
      for (const model of models) {
        const heavy = keyMetrics.filter(
          (metric) => metric.probeMode === 'HEAVY' && metric.testModel === model.modelName
        );
        const snapshot = latestPrice.get(`key:${k.id}:${model.modelName}`)
          || latestPrice.get(`upstream:${u.id}:${model.modelName}`);
        const price = resolvePrice(snapshot, model, k.groupRateMultiplier, u.creditUsdPerCny);
        list.push({
          keyId: k.id,
          monitoredModelId: model.id || null,
          upstreamId: u.id,
          upstreamName: u.name,
          upstreamStatus: u.status,
          baseUrl: u.baseUrl,
          type: u.type,
          group: k.group,
          label: k.label,
          keyName: k.keyName,
          groupName: k.groupName,
          groupDescription: k.groupDescription,
          groupRateMultiplier: k.groupRateMultiplier,
          creditUsdPerCny: u.creditUsdPerCny,
          remoteKeyId: k.remoteKeyId,
          status: k.status,
          balance: convertUsdCreditToCny(sharedBalances.get(u.id), u.creditUsdPerCny),
          latencyMs: k.lastLatencyMs,
          hasApiKey: Boolean(k.apiKeyEnc),
          hasAccessToken: Boolean(k.accessTokenEnc),
          testModel: model.modelName,
          lastCollectedAt: k.lastCollectedAt,
          lastError: k.lastError,
          openIncidents: keyAlerts.open,
          resolvedIncidents: keyAlerts.resolved,
          upstreamOpenIncidents: upstreamAlerts.open,
          upstreamResolvedIncidents: upstreamAlerts.resolved,
          lightSuccessCount24h: keyLightMetrics.filter((metric) => metric.success).length,
          lightSampleCount24h: keyLightMetrics.length,
          availability24h: keyMetrics.length ? Math.round(keyMetrics.filter((metric) => metric.success).length / keyMetrics.length * 1000) / 10 : null,
          generationSuccess24h: heavy.length ? Math.round(heavy.filter((metric) => metric.success).length / heavy.length * 1000) / 10 : null,
          sampleCount24h: heavy.length,
          averageLatencyMs: average(heavy.map((metric) => metric.modelTestLatMs)),
          recentProbes: heavy.slice(-12).map((metric) => metric.success),
          price,
        });
      }
    }
  }

  return NextResponse.json({
    summary: {
      total,
      online,
      degraded,
      offline,
      totalKeys: allKeys.length,
      totalBalance: Math.round(totalBalance * 100) / 100,
      availability: Math.round(availability * 10) / 10,
      openIncidents,
      resolvedIncidents,
    },
    items: list,
  });
}

function resolvePrice(
  snapshot: { currency: string; inputPrice: number | null; outputPrice: number | null; cacheReadPrice: number | null; source: string } | undefined,
  model: { officialInputPrice: number | null; officialOutputPrice: number | null },
  multiplier: number | null,
  creditUsdPerCny: number,
) {
  if (snapshot) {
    const divisor = snapshot.currency === 'USD' ? creditUsdPerCny : 1;
    return {
      currency: snapshot.currency === 'USD' ? 'CNY' : snapshot.currency,
      inputPrice: snapshot.inputPrice == null ? null : snapshot.inputPrice / divisor,
      outputPrice: snapshot.outputPrice == null ? null : snapshot.outputPrice / divisor,
      cacheReadPrice: snapshot.cacheReadPrice == null ? null : snapshot.cacheReadPrice / divisor,
      source: snapshot.source,
    };
  }
  const inputPrice = calculateEffectivePrice(model.officialInputPrice, multiplier, creditUsdPerCny);
  const outputPrice = calculateEffectivePrice(model.officialOutputPrice, multiplier, creditUsdPerCny);
  if (inputPrice == null && outputPrice == null) return null;
  return { currency: 'CNY', inputPrice, outputPrice, cacheReadPrice: null, source: 'CALCULATED' };
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}
