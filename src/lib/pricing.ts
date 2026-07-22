import type { PriceItem } from './adapters/base';

const DEFAULT_QUOTA_PER_UNIT = 500000;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function number(value: unknown): number | undefined {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
}

/** 将 New API 倍率制价格转换为 USD / 1M Token。 */
export function normalizeNewApiPricing(
  pricingPayload: unknown,
  statusPayload?: unknown,
  groupName?: string
): PriceItem[] {
  const pricingRoot = record(pricingPayload);
  const statusRoot = record(statusPayload);
  const statusData = record(statusRoot?.data);
  const quotaPerUnit = number(statusData?.quota_per_unit) ?? number(statusData?.quotaPerUnit) ?? DEFAULT_QUOTA_PER_UNIT;
  if (quotaPerUnit <= 0) return [];

  const rows = Array.isArray(pricingRoot?.data) ? pricingRoot.data : [];
  const groupRatios = record(pricingRoot?.group_ratio);
  const groupMultiplier = groupName ? number(groupRatios?.[groupName]) ?? 1 : 1;

  return rows.flatMap((value): PriceItem[] => {
    const row = record(value);
    const modelName = typeof row?.model_name === 'string' ? row.model_name.trim() : '';
    if (!row || !modelName) return [];
    const rawData = { ...row, applied_group_multiplier: groupMultiplier };
    if (number(row.quota_type) === 1) {
      const fixedPrice = number(row.model_price);
      return fixedPrice === undefined ? [] : [{ modelName, currency: 'USD', fixedPrice: fixedPrice * groupMultiplier, rawData }];
    }
    const modelRatio = number(row.model_ratio);
    if (modelRatio === undefined) return [];
    const inputPrice = modelRatio * 1_000_000 / quotaPerUnit * groupMultiplier;
    const completionRatio = number(row.completion_ratio) ?? 1;
    const cacheRatio = number(row.cache_ratio);
    return [{
      modelName,
      currency: 'USD',
      inputPrice,
      outputPrice: inputPrice * completionRatio,
      cacheReadPrice: cacheRatio === undefined ? undefined : inputPrice * cacheRatio,
      rawData,
    }];
  });
}

export function percentile(values: Array<number | null | undefined>, p: number): number | null {
  const sorted = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}
