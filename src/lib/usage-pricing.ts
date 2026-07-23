import type { ModelUsageStats } from './adapters/base';
import { prisma } from './db';
import { getOfficialModelPrice } from './official-model-prices';
import { formatMultiplier, hasVisibleMultiplierChange } from './pricing';

export interface UsagePoint {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  actualCost: number;
}

export interface BaselinePrices {
  inputPrice?: number | null;
  outputPrice?: number | null;
  cacheReadPrice?: number | null;
  cacheWritePrice?: number | null;
}

export function estimatePricingFromUsage(
  previous: UsagePoint,
  current: UsagePoint,
  baseline: BaselinePrices
) {
  const delta = {
    inputTokens: current.inputTokens - previous.inputTokens,
    outputTokens: current.outputTokens - previous.outputTokens,
    cacheReadTokens: current.cacheReadTokens - previous.cacheReadTokens,
    cacheWriteTokens: current.cacheWriteTokens - previous.cacheWriteTokens,
    actualCost: current.actualCost - previous.actualCost,
  };
  if (Object.values(delta).some((value) => value < 0) || delta.actualCost <= 0) return null;

  const components: Array<[number, number | null | undefined]> = [
    [delta.inputTokens, baseline.inputPrice],
    [delta.outputTokens, baseline.outputPrice],
    [delta.cacheReadTokens, baseline.cacheReadPrice],
    [delta.cacheWriteTokens, baseline.cacheWritePrice],
  ];
  if (components.some(([tokens, price]) => tokens > 0 && price == null)) return null;
  const baselineCost = components.reduce((sum, [tokens, price]) => sum + tokens * (price ?? 0) / 1_000_000, 0);
  if (baselineCost <= 0) return null;

  const multiplier = delta.actualCost / baselineCost;
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 100) return null;
  return { multiplier, baselineCost, delta };
}

export async function recordUsagePricing(params: {
  upstreamId: number;
  upstreamKeyId: number;
  configuredMultiplier: number | null;
  stats: ModelUsageStats[];
  dynamicPricing?: boolean;
}) {
  for (const stat of params.stats) {
    const previous = await prisma.usageSnapshot.findFirst({
      where: { upstreamKeyId: params.upstreamKeyId, modelName: stat.modelName },
      orderBy: { recordedAt: 'desc' },
    });
    if (previous && usageUnchanged(previous, stat)) continue;
    await prisma.usageSnapshot.create({
      data: {
        upstreamId: params.upstreamId,
        upstreamKeyId: params.upstreamKeyId,
        modelName: stat.modelName,
        inputTokens: stat.inputTokens,
        outputTokens: stat.outputTokens,
        cacheReadTokens: stat.cacheReadTokens,
        cacheWriteTokens: stat.cacheWriteTokens,
        accountCost: stat.accountCost,
        actualCost: stat.actualCost,
      },
    });
    const price = await prisma.priceSnapshot.findFirst({
      where: {
        upstreamId: params.upstreamId,
        modelName: stat.modelName,
        OR: [{ upstreamKeyId: params.upstreamKeyId }, { upstreamKeyId: null }],
      },
      orderBy: { recordedAt: 'desc' },
    });
    const configuredMultiplier = params.configuredMultiplier && params.configuredMultiplier > 0
      ? params.configuredMultiplier
      : null;
    const official = getOfficialModelPrice(stat.modelName);
    const baseline = official
      ? { inputPrice: official.input, outputPrice: official.output, cacheReadPrice: null, cacheWritePrice: null }
      : price && configuredMultiplier
        ? {
            inputPrice: dividePrice(price.inputPrice, configuredMultiplier),
            outputPrice: dividePrice(price.outputPrice, configuredMultiplier),
            cacheReadPrice: dividePrice(price.cacheReadPrice, configuredMultiplier),
            cacheWritePrice: dividePrice(price.cacheWritePrice, configuredMultiplier),
          }
        : null;
    if (!previous || !baseline || !price) continue;
    const measured = estimatePricingFromUsage(previous, stat, baseline);
    if (!measured) continue;

    const roundedMultiplier = round(measured.multiplier, 4);
    const lastMeasured = await prisma.priceSnapshot.findFirst({
      where: { upstreamKeyId: params.upstreamKeyId, modelName: stat.modelName, source: 'MEASURED' },
      orderBy: { recordedAt: 'desc' },
    });
    const previousMeasuredMultiplier = readMeasuredMultiplier(lastMeasured?.rawData);
    const referenceMultiplier = params.dynamicPricing ? previousMeasuredMultiplier : configuredMultiplier;
    const relativeChange = referenceMultiplier
      ? Math.abs(roundedMultiplier - referenceMultiplier) / referenceMultiplier
      : 0;
    const verificationExpired = !lastMeasured || lastMeasured.recordedAt.getTime() < Date.now() - 24 * 60 * 60 * 1000;
    if (relativeChange < 0.02 && !verificationExpired) continue;

    const nextPrice = {
      inputPrice: multiplyPrice(baseline.inputPrice, roundedMultiplier),
      outputPrice: multiplyPrice(baseline.outputPrice, roundedMultiplier),
      cacheReadPrice: multiplyPrice(baseline.cacheReadPrice, roundedMultiplier),
      cacheWritePrice: multiplyPrice(baseline.cacheWritePrice, roundedMultiplier),
    };
    await prisma.$transaction(async (tx) => {
      if (!params.dynamicPricing) {
        await tx.upstreamKey.update({
          where: { id: params.upstreamKeyId },
          data: { groupRateMultiplier: roundedMultiplier },
        });
      }
      await tx.priceSnapshot.create({
        data: {
          upstreamId: params.upstreamId,
          upstreamKeyId: params.upstreamKeyId,
          modelName: stat.modelName,
          currency: price.currency,
          ...nextPrice,
          source: 'MEASURED',
          rawData: {
            previousMultiplier: referenceMultiplier,
            measuredMultiplier: measured.multiplier,
            baselineCost: measured.baselineCost,
            actualCost: measured.delta.actualCost,
            tokenDelta: measured.delta,
          },
        },
      });
      if (relativeChange >= 0.05 && referenceMultiplier != null
        && hasVisibleMultiplierChange(referenceMultiplier, roundedMultiplier)) {
        await tx.incident.create({
          data: {
            upstreamId: params.upstreamId,
            upstreamKeyId: params.upstreamKeyId,
            type: 'PRICE_CHANGED',
            severity: 'WARNING',
            message: `${stat.modelName} 倍率从 ${formatMultiplier(referenceMultiplier)} 变为 ${formatMultiplier(roundedMultiplier)}`,
            metricValue: roundedMultiplier,
          },
        });
      }
    });
  }
}

function usageUnchanged(previous: UsagePoint, current: UsagePoint) {
  return previous.inputTokens === current.inputTokens
    && previous.outputTokens === current.outputTokens
    && previous.cacheReadTokens === current.cacheReadTokens
    && previous.cacheWriteTokens === current.cacheWriteTokens
    && previous.actualCost === current.actualCost;
}

function readMeasuredMultiplier(rawData: unknown): number | null {
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) return null;
  const value = (rawData as Record<string, unknown>).measuredMultiplier;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function dividePrice(value: number | null, multiplier: number) {
  return value == null ? null : value / multiplier;
}

function multiplyPrice(value: number | null | undefined, multiplier: number) {
  return value == null ? null : round(value * multiplier, 6);
}

function round(value: number, digits: number) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
