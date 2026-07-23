/**
 * 采集器：对每个 UpstreamKey（分组/Token 监控单元）执行指标采集
 * 采集维度为 key（分组级），采集完一个 upstream 的所有 key 后聚合汇总状态
 */
import type { Upstream, UpstreamKey } from '@prisma/client';
import { createHash } from 'crypto';
import { prisma } from './db';
import { getAdapter } from './adapters/registry';
import type { AdapterContext, BalanceResult, LatencyResult } from './adapters/base';
import { tryDecrypt } from './crypto';
import { getCollectConfig } from './settings';
import { evaluateAlerts } from './alerts/engine';
import type { UpstreamType } from './domain-types';
import { recordUsagePricing } from './usage-pricing';
import { runRetentionCleanup } from './retention';
import { runInConcurrencyLanes } from './concurrency-lanes';
import { syncDynamicModelPrice } from './dynamic-pricing';
import { withCredentialLane } from './monitor-runtime';
import { combineCollectionAndModelStatus } from './model-health';

export type CollectMode = 'light' | 'heavy';

type UpstreamKeyWithUpstream = UpstreamKey & { upstream: Upstream };

type UpstreamWithKeys = Upstream & { keys: UpstreamKey[] };

interface LightCollectionResult {
  balance: BalanceResult;
  latency: LatencyResult;
}

/**
 * 对单个 key 执行采集
 */
export async function collectOneKey(
  key: UpstreamKeyWithUpstream,
  mode: CollectMode,
  monitoredModelId?: number,
  lightResultsCache?: Map<string, Promise<LightCollectionResult>>,
) {
  return withCredentialLane(
    credentialLaneKey({ upstream: key.upstream, key }),
    () => collectOneKeyInLane(key, mode, monitoredModelId, lightResultsCache),
  );
}

async function collectOneKeyInLane(
  key: UpstreamKeyWithUpstream,
  mode: CollectMode,
  monitoredModelId?: number,
  lightResultsCache?: Map<string, Promise<LightCollectionResult>>,
) {
  const { upstream } = key;

  // 凭证解密
  const apiKey = key.apiKeyEnc ? tryDecrypt(key.apiKeyEnc) : null;
  const accessToken = key.accessTokenEnc ? tryDecrypt(key.accessTokenEnc) : null;
  if (!apiKey && !accessToken) {
    await prisma.upstreamKey.update({
      where: { id: key.id },
      data: { lastError: '未配置任何凭证', status: 'UNKNOWN' },
    });
    return null;
  }

  const config = await getCollectConfig();
  const adapter = getAdapter(upstream.type as UpstreamType);
  const monitoredModel = mode === 'heavy'
    ? await prisma.monitoredModel.findFirst({
        where: {
          upstreamKeyId: key.id,
          enabled: true,
          ...(monitoredModelId != null ? { id: monitoredModelId } : {}),
        },
        orderBy: [{ lastTestedAt: 'asc' }, { id: 'asc' }],
      })
    : null;
  if (mode === 'heavy' && !monitoredModel) {
    await prisma.upstreamKey.update({
      where: { id: key.id },
      data: { lastError: '未配置监测模型', status: 'UNKNOWN' },
    });
    return null;
  }
  const selectedModel = monitoredModel?.modelName || key.testModel || '';
  const ctx: AdapterContext = {
    baseUrl: upstream.baseUrl,
    apiKey: apiKey || '',
    accessToken: accessToken || undefined,
    userId: key.userId || undefined,
    timeoutMs: config.timeoutMs,
    testModel: selectedModel,
    groupName: key.groupName || key.group,
    keyName: key.keyName || undefined,
  };

  const errors: string[] = [];

  // 轻量采集
  const lightCacheKey = lightCollectionKey(ctx, upstream.type);
  let lightResultsPromise = lightResultsCache?.get(lightCacheKey);
  if (!lightResultsPromise) {
    lightResultsPromise = (async () => {
      // 同一个凭证的两个轻量请求保持顺序执行，避免瞬时并发触发站点限流。
      const balance = await adapter.queryBalance(ctx);
      const latency = await adapter.testLatency(ctx);
      return { balance, latency };
    })();
    lightResultsCache?.set(lightCacheKey, lightResultsPromise);
  }
  const { balance: balanceRes, latency: latencyRes } = await lightResultsPromise;

  // 重量采集
  let modelRes = null;
  if (mode === 'heavy') {
    modelRes = await adapter.testModel(ctx, ctx.testModel);
    if (upstream.type === 'NEW_API') {
      await syncDynamicModelPrice({
        upstreamId: upstream.id,
        upstreamKeyId: key.id,
        modelName: ctx.testModel,
        officialInputPrice: monitoredModel?.officialInputPrice,
        officialOutputPrice: monitoredModel?.officialOutputPrice,
        creditUsdPerCny: upstream.creditUsdPerCny,
        adapter,
        context: ctx,
      }).catch((error) => {
        console.warn('[pricing] dynamic price sync failed:', error instanceof Error ? error.message : error);
      });
    }
    if (monitoredModel) {
      await prisma.monitoredModel.update({
        where: { id: monitoredModel.id },
        data: { lastTestedAt: new Date() },
      });
    }
  }

  if (!balanceRes.ok && balanceRes.supported !== false) errors.push(`余额: ${balanceRes.errorMessage}`);
  if (!latencyRes.ok) errors.push(`延迟: ${latencyRes.errorMessage}`);
  if (modelRes && !modelRes.ok) errors.push(`模型: ${modelRes.errorMessage}`);

  const success = mode === 'heavy'
    ? Boolean(modelRes?.ok)
    : balanceRes.ok || latencyRes.ok;
  const errorMessage = errors.length > 0 ? errors.join('; ') : null;

  // 写入指标（同时关联 upstreamId 和 upstreamKeyId）
  const metric = await prisma.metric.create({
    data: {
      upstreamId: upstream.id,
      upstreamKeyId: key.id,
      balance: balanceRes.balance ?? null,
      latencyMs: latencyRes.latencyMs ?? null,
      modelTestOk: modelRes?.ok ?? null,
      modelTestLatMs: modelRes?.latencyMs ?? null,
      streamTps: null,
      streamFirstLat: null,
      streamTotalMs: null,
      probeMode: mode.toUpperCase(),
      testModel: ctx.testModel,
      errorCode: classifyError(errors),
      success,
      errorMessage,
    },
  });

  // 更新 key 缓存
  const collectionStatus = deriveStatus(balanceRes, latencyRes, modelRes);
  const latestModelResults = await getLatestEnabledModelResults(key.id);
  const newStatus = combineCollectionAndModelStatus(collectionStatus, latestModelResults);
  const updateData: Record<string, unknown> = {
    status: newStatus,
    lastBalance: balanceRes.balance ?? undefined,
    lastLatencyMs: latencyRes.latencyMs ?? undefined,
    lastCollectedAt: new Date(),
    lastError: errorMessage,
  };

  // SUB2API 的 planName 是远端展示名，不覆盖用户配置的稳定分组标识。
  if (upstream.type === 'SUB2API' && balanceRes.groupName) {
    updateData.groupName = balanceRes.groupName;
  }

  await prisma.upstreamKey.update({
    where: { id: key.id },
    data: updateData,
  });

  if (balanceRes.usageStats?.length) {
    await recordUsagePricing({
      upstreamId: upstream.id,
      upstreamKeyId: key.id,
      configuredMultiplier: key.groupRateMultiplier,
      stats: balanceRes.usageStats,
      dynamicPricing: upstream.type === 'NEW_API',
    }).catch((error) => {
      console.warn('[pricing] usage snapshot failed:', error instanceof Error ? error.message : error);
    });
  }

  // 告警判断（按 key）
  await evaluateAlerts(key.id);

  return metric;
}

function classifyError(errors: string[]): string | null {
  const message = errors.join(' ');
  if (!message) return null;
  if (/429/.test(message)) return 'RATE_LIMITED';
  if (/401|403/.test(message)) return 'AUTH';
  if (/超时|abort|timeout/i.test(message)) return 'TIMEOUT';
  if (/5\d\d/.test(message)) return 'UPSTREAM_5XX';
  if (/流式|token|body/i.test(message)) return 'STREAM';
  return 'OTHER';
}

function deriveStatus(
  balance: { ok: boolean },
  latency: { ok: boolean; latencyMs?: number },
  model?: { ok: boolean } | null
): UpstreamKey['status'] {
  if (!balance.ok && !latency.ok) return 'OFFLINE';
  if (model && !model.ok) return 'DEGRADED';
  if (latency.ok && latency.latencyMs && latency.latencyMs > 3000) return 'DEGRADED';
  return 'ONLINE';
}

async function getLatestEnabledModelResults(upstreamKeyId: number) {
  const models = await prisma.monitoredModel.findMany({
    where: { upstreamKeyId, enabled: true },
    select: { modelName: true },
  });
  return Promise.all(models.map(async (model) => {
    const latest = await prisma.metric.findFirst({
      where: {
        upstreamKeyId,
        probeMode: 'HEAVY',
        testModel: model.modelName,
        modelTestOk: { not: null },
      },
      orderBy: { recordedAt: 'desc' },
      select: { modelTestOk: true },
    });
    return latest?.modelTestOk ?? null;
  }));
}

/** 聚合多个 key 的状态为 upstream 汇总状态 */
export function aggregateStatus(statuses: string[]): Upstream['status'] {
  if (statuses.length === 0) return 'UNKNOWN';
  if (statuses.every((s) => s === 'ONLINE')) return 'ONLINE';
  if (statuses.every((s) => s === 'OFFLINE')) return 'OFFLINE';
  if (statuses.some((s) => s === 'OFFLINE') && !statuses.some((s) => s === 'ONLINE' || s === 'DEGRADED')) return 'OFFLINE';
  return 'DEGRADED';
}

/** 创建可测试的上游批量采集流程。 */
interface CollectionJob {
  upstream: Upstream;
  key: UpstreamKey;
}

export interface KeyCollectionResult {
  upstreamId: number;
  keyId: number;
  result: PromiseSettledResult<Awaited<ReturnType<typeof collectOneKey>>>;
}

export async function collectUpstreamsByCredential(
  upstreams: readonly UpstreamWithKeys[],
  mode: CollectMode,
): Promise<KeyCollectionResult[]> {
  const jobs: CollectionJob[] = upstreams.flatMap((upstream) => (
    upstream.keys.map((key) => ({ upstream, key }))
  ));
  const lightResultsCache = new Map<string, Promise<LightCollectionResult>>();
  const results = await runInConcurrencyLanes(
    jobs,
    credentialLaneKey,
    ({ upstream, key }) => collectOneKey({ ...key, upstream }, mode, undefined, lightResultsCache),
  );

  await Promise.all(upstreams.map((upstream) => refreshUpstreamAggregateStatus(upstream.id)));
  return jobs.map((job, index) => ({
    upstreamId: job.upstream.id,
    keyId: job.key.id,
    result: results[index],
  }));
}

function credentialLaneKey({ upstream, key }: CollectionJob) {
  const credential = (key.apiKeyEnc ? tryDecrypt(key.apiKeyEnc) : null)
    || (key.accessTokenEnc ? tryDecrypt(key.accessTokenEnc) : null)
    || `missing-key-${key.id}`;
  const endpoint = upstream.baseUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/v1\/?$/, '')
    .replace(/\/+$/, '');
  return createHash('sha256').update(`${endpoint}\0${credential}`).digest('hex');
}

function lightCollectionKey(ctx: AdapterContext, upstreamType: string) {
  const endpoint = ctx.baseUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/v1\/?$/, '')
    .replace(/\/+$/, '');
  // New API 的余额身份还取决于访问令牌和用户 ID，纳入指纹可避免跨账户复用余额。
  return createHash('sha256').update([
    upstreamType,
    endpoint,
    ctx.apiKey,
    ctx.accessToken || '',
    ctx.userId || '',
  ].join('\0')).digest('hex');
}

/** 对一个上游的指定 keys 执行采集，并刷新上游汇总状态。 */
export async function collectUpstreamKeys(
  upstream: UpstreamWithKeys,
  mode: CollectMode
) {
  const collection = await collectUpstreamsByCredential([upstream], mode);
  const status = await prisma.upstream.findUnique({
    where: { id: upstream.id },
    select: { status: true },
  });
  return { results: collection.map((item) => item.result), status: status?.status || 'UNKNOWN' };
}

/** 只根据当前 key 缓存重新计算上游汇总状态。 */
export async function refreshUpstreamAggregateStatus(upstreamId: number) {
  const keys = await prisma.upstreamKey.findMany({
    where: { upstreamId, enabled: true },
    select: { status: true },
  });
  const status = aggregateStatus(keys.map((key) => key.status));
  await prisma.upstream.update({
    where: { id: upstreamId },
    data: { status },
  });
  return status;
}

/**
 * 执行一轮采集（被 cron 调用）
 */
export async function runCollectCycle(): Promise<{ collected: number; mode: CollectMode }> {
  const config = await getCollectConfig();
  const now = new Date();
  const minuteSlot = Math.floor(now.getTime() / 60000);
  const mode: CollectMode = minuteSlot % config.heavyMin === 0 ? 'heavy' : 'light';

  // 查所有 enabled upstream 的 enabled keys
  const upstreams = await prisma.upstream.findMany({
    where: { enabled: true },
    include: { keys: { where: { enabled: true } } },
  });

  const collection = await collectUpstreamsByCredential(upstreams, mode);

  await runRetentionCleanup(config.retentionDays);

  return { collected: collection.length, mode };
}

/** 手动触发单个 key 的完整采集 */
export async function collectOneKeyManual(keyId: number, monitoredModelId?: number) {
  const key = await prisma.upstreamKey.findUnique({
    where: { id: keyId },
    include: { upstream: true },
  });
  if (!key) throw new Error('Key 不存在');
  if (monitoredModelId != null) {
    const model = await prisma.monitoredModel.findFirst({
      where: { id: monitoredModelId, upstreamKeyId: keyId, enabled: true },
      select: { id: true },
    });
    if (!model) throw new Error('模型不存在或未启用');
  }
  const metric = await collectOneKey(key, 'heavy', monitoredModelId);
  await refreshUpstreamAggregateStatus(key.upstreamId);
  return metric;
}
