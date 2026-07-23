import type { Prisma } from '@prisma/client';
import type { AdapterContext, UpstreamAdapter } from './adapters/base';
import { prisma } from './db';
import { getOfficialModelPrice } from './official-model-prices';
import {
  deriveDisplayedMultiplier,
  formatMultiplier,
  hasVisibleMultiplierChange,
  maxRelativePriceChange,
} from './pricing';

const PRICE_REFRESH_MS = 24 * 60 * 60 * 1000;
const PRICE_CHANGE_THRESHOLD = 0.05;

export async function syncDynamicModelPrice(params: {
  upstreamId: number;
  upstreamKeyId: number;
  modelName: string;
  officialInputPrice?: number | null;
  officialOutputPrice?: number | null;
  creditUsdPerCny: number;
  adapter: UpstreamAdapter;
  context: AdapterContext;
}) {
  if (!params.adapter.queryActualPrices && !params.adapter.queryPricing) return { status: 'unsupported' as const };

  const usesActualLog = Boolean(params.adapter.queryActualPrices);
  const result = params.adapter.queryActualPrices
    ? await params.adapter.queryActualPrices(params.context, params.modelName)
    : await params.adapter.queryPricing!(params.context);
  if (!result.ok || !result.prices) {
    return { status: 'error' as const, errorMessage: result.errorMessage || '价格同步失败' };
  }

  const price = result.prices.find((item) => item.modelName === params.modelName)
    || result.prices.find((item) => item.modelName.toLowerCase() === params.modelName.toLowerCase());
  if (!price) return { status: 'missing' as const };

  const previous = await prisma.priceSnapshot.findFirst({
    where: {
      upstreamKeyId: params.upstreamKeyId,
      modelName: params.modelName,
      source: usesActualLog ? 'OBSERVED' : 'AUTO',
    },
    orderBy: { recordedAt: 'desc' },
  });
  const relativeChange = previous ? maxRelativePriceChange(previous, price) : null;
  const catalogPrice = getOfficialModelPrice(params.modelName);
  const officialPrice = {
    input: params.officialInputPrice ?? catalogPrice?.input,
    output: params.officialOutputPrice ?? catalogPrice?.output,
  };
  const previousMultiplier = previous
    ? deriveDisplayedMultiplier(previous, officialPrice, params.creditUsdPerCny)
    : null;
  const nextMultiplier = deriveDisplayedMultiplier(price, officialPrice, params.creditUsdPerCny);
  const refreshExpired = !previous || previous.recordedAt.getTime() < Date.now() - PRICE_REFRESH_MS;
  if (previous && relativeChange !== null && relativeChange < 0.0001 && !refreshExpired) {
    return { status: 'unchanged' as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.priceSnapshot.create({
      data: {
        upstreamId: params.upstreamId,
        upstreamKeyId: params.upstreamKeyId,
        modelName: params.modelName,
        currency: price.currency,
        inputPrice: price.inputPrice,
        outputPrice: price.outputPrice,
        cacheReadPrice: price.cacheReadPrice,
        cacheWritePrice: price.cacheWritePrice,
        fixedPrice: price.fixedPrice,
        source: usesActualLog ? 'OBSERVED' : 'AUTO',
        rawData: {
          ...(price.rawData || {}),
          observationMode: usesActualLog ? 'actual-route-log' : 'catalog-reference',
          previousSnapshotId: previous?.id,
          relativeChange,
        } as Prisma.InputJsonValue,
      },
    });

    if (previous && relativeChange != null && relativeChange >= PRICE_CHANGE_THRESHOLD
      && previousMultiplier != null && nextMultiplier != null
      && hasVisibleMultiplierChange(previousMultiplier, nextMultiplier)) {
      await tx.incident.create({
        data: {
          upstreamId: params.upstreamId,
          upstreamKeyId: params.upstreamKeyId,
          type: 'PRICE_CHANGED',
          severity: 'WARNING',
          message: `${params.modelName} 倍率从 ${formatMultiplier(previousMultiplier)} 变为 ${formatMultiplier(nextMultiplier)}`,
          metricValue: nextMultiplier,
        },
      });
    }
  });

  return { status: previous ? 'changed' as const : 'created' as const, relativeChange };
}
