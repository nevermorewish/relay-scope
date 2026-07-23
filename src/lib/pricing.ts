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

export function calculateNewApiLogPrices(params: {
  modelRatio: number;
  completionRatio?: number;
  cacheRatio?: number;
  groupRatio?: number;
  userGroupRatio?: number;
  quotaPerUnit?: number;
}) {
  const quotaPerUnit = params.quotaPerUnit ?? DEFAULT_QUOTA_PER_UNIT;
  if (params.modelRatio < 0 || quotaPerUnit <= 0) return null;
  const multiplier = (params.groupRatio && params.groupRatio > 0 ? params.groupRatio : 1)
    * (params.userGroupRatio && params.userGroupRatio > 0 ? params.userGroupRatio : 1);
  const inputPrice = params.modelRatio * 1_000_000 / quotaPerUnit * multiplier;
  return {
    inputPrice,
    outputPrice: inputPrice * (params.completionRatio ?? 1),
    cacheReadPrice: params.cacheRatio == null ? undefined : inputPrice * params.cacheRatio,
  };
}

export function percentile(values: Array<number | null | undefined>, p: number): number | null {
  const sorted = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

export interface ComparablePrice {
  inputPrice?: number | null;
  outputPrice?: number | null;
  cacheReadPrice?: number | null;
  cacheWritePrice?: number | null;
  fixedPrice?: number | null;
}

/** 返回两次价格中最大的相对变化；没有可比较字段时返回 null。 */
export function maxRelativePriceChange(previous: ComparablePrice, current: ComparablePrice): number | null {
  const fields: Array<keyof ComparablePrice> = [
    'inputPrice', 'outputPrice', 'cacheReadPrice', 'cacheWritePrice', 'fixedPrice',
  ];
  const changes = fields.flatMap((field) => {
    const before = previous[field];
    const after = current[field];
    if (before == null || after == null || !Number.isFinite(before) || !Number.isFinite(after)) return [];
    if (before === 0) return after === 0 ? [0] : [Infinity];
    return [Math.abs(after - before) / Math.abs(before)];
  });
  return changes.length ? Math.max(...changes) : null;
}

/** 按官方输入/输出价反推当前模型的有效倍率。 */
export function deriveEffectiveMultiplier(
  price: ComparablePrice,
  official: { input?: number | null; output?: number | null },
): number | null {
  const ratios: number[] = [];
  if (price.inputPrice != null && official.input != null && official.input > 0) {
    ratios.push(price.inputPrice / official.input);
  }
  if (price.outputPrice != null && official.output != null && official.output > 0) {
    ratios.push(price.outputPrice / official.output);
  }
  if (!ratios.length || ratios.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  return Math.round((ratios.reduce((sum, value) => sum + value, 0) / ratios.length) * 10000) / 10000;
}

export function deriveDisplayedMultiplier(
  price: ComparablePrice,
  official: { input?: number | null; output?: number | null },
  creditUsdPerCny: number,
): number | null {
  if (!Number.isFinite(creditUsdPerCny) || creditUsdPerCny <= 0) return null;
  const multiplier = deriveEffectiveMultiplier(price, official);
  return multiplier == null ? null : Math.round(multiplier / creditUsdPerCny * 10000) / 10000;
}

export function formatMultiplier(value: number): string {
  return value.toFixed(2);
}

export function hasVisibleMultiplierChange(previous: number, next: number): boolean {
  return formatMultiplier(previous) !== formatMultiplier(next);
}
