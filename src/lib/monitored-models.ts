import { getOfficialModelPrice } from './official-model-prices';

export interface MonitoredModelInput {
  modelName?: unknown;
  officialInputPrice?: unknown;
  officialOutputPrice?: unknown;
  enabled?: unknown;
}

export interface NormalizedMonitoredModel {
  modelName: string;
  officialInputPrice: number | null;
  officialOutputPrice: number | null;
  officialPriceSource: string;
  enabled: boolean;
}

export function normalizeMonitoredModels(input: unknown): NormalizedMonitoredModel[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.flatMap((value) => {
    const row = (value || {}) as MonitoredModelInput;
    const modelName = typeof row.modelName === 'string' ? row.modelName.trim() : '';
    if (!modelName || seen.has(modelName)) return [];
    seen.add(modelName);
    const catalog = getOfficialModelPrice(modelName);
    const inputPrice = optionalNonNegative(row.officialInputPrice, catalog?.input ?? null);
    const outputPrice = optionalNonNegative(row.officialOutputPrice, catalog?.output ?? null);
    return [{
      modelName,
      officialInputPrice: inputPrice,
      officialOutputPrice: outputPrice,
      officialPriceSource: catalog && inputPrice === catalog.input && outputPrice === catalog.output
        ? catalog.source
        : 'MANUAL',
      enabled: row.enabled !== false,
    }];
  });
}

function optionalNonNegative(value: unknown, fallback: number | null) {
  if (value === '' || value == null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
