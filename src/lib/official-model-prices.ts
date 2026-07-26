import catalogJson from '../../data/model-catalog.json';
import {
  type CatalogCurrency,
  type CatalogPriceTier,
  type ModelCatalogDocument,
  type ModelProvider,
} from './model-catalog-schema';

export type { CatalogCurrency, CatalogPriceTier, ModelProvider } from './model-catalog-schema';

export interface OfficialModelPrice {
  id: string;
  provider: ModelProvider;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  cnyInput: number | null;
  cnyOutput: number | null;
  cnyCacheRead: number | null;
  cnyCacheWrite: number | null;
  usdTiers: ReadonlyArray<CatalogPriceTier>;
  cnyTiers: ReadonlyArray<CatalogPriceTier>;
  contextWindow: number | null;
  maxOutput: number | null;
  officialUrl: string;
  source: string;
  verifiedAt: string;
  note?: string;
  cnyNote?: string;
}

export const MODEL_CATALOG_DOCUMENT = catalogJson as unknown as Readonly<ModelCatalogDocument>;
export const MODEL_CATALOG_SCHEMA_VERSION = MODEL_CATALOG_DOCUMENT.schemaVersion;
export const MODEL_CATALOG_VERSION = MODEL_CATALOG_DOCUMENT.catalogVersion;
export const MODEL_CATALOG_UPDATED_AT = MODEL_CATALOG_DOCUMENT.updatedAt;
export const MODEL_CATALOG_USD_TO_CNY_RATE = MODEL_CATALOG_DOCUMENT.usdToCnyRate;
export const MODEL_PROVIDERS = MODEL_CATALOG_DOCUMENT.providers.map((provider) => provider.name) as ReadonlyArray<ModelProvider>;

export const MODEL_PROVIDER_OFFICIAL_URLS: Readonly<Record<ModelProvider, string>> = Object.fromEntries(
  MODEL_CATALOG_DOCUMENT.providers.map((provider) => [provider.name, provider.officialUrl]),
) as Record<ModelProvider, string>;

export const OFFICIAL_MODEL_CATALOG: ReadonlyArray<OfficialModelPrice> = MODEL_CATALOG_DOCUMENT.prices.map((price) => ({
  id: price.id,
  provider: price.provider,
  input: price.usd.input,
  output: price.usd.output,
  cacheRead: price.usd.cacheRead,
  cacheWrite: price.usd.cacheWrite,
  cnyInput: price.cny.input,
  cnyOutput: price.cny.output,
  cnyCacheRead: price.cny.cacheRead,
  cnyCacheWrite: price.cny.cacheWrite,
  usdTiers: price.usd.tiers ?? [],
  cnyTiers: price.cny.tiers ?? [],
  contextWindow: price.contextWindow,
  maxOutput: price.maxOutput,
  officialUrl: price.officialUrl,
  verifiedAt: price.verifiedAt,
  note: price.usdNote,
  cnyNote: price.cnyNote,
  source: `官方价格目录（${price.verifiedAt} 核验）`,
}));

const OFFICIAL_MODEL_PRICES: Readonly<Record<string, OfficialModelPrice>> = Object.fromEntries(
  OFFICIAL_MODEL_CATALOG.map((model) => [model.id, model]),
);

const MODEL_ALIASES: Readonly<Record<string, string>> = MODEL_CATALOG_DOCUMENT.aliases;

export function getOfficialModelPrice(modelName: string): OfficialModelPrice | null {
  const key = normalizeModelLookupKey(modelName);
  return OFFICIAL_MODEL_PRICES[MODEL_ALIASES[key] || key] || null;
}

export function filterOfficialModelCatalog(
  catalog: ReadonlyArray<OfficialModelPrice>,
  query: string,
  provider: ModelProvider | 'ALL',
) {
  const normalizedQuery = query.trim().toLowerCase();
  return catalog.filter((model) => (
    (provider === 'ALL' || model.provider === provider)
    && (!normalizedQuery || model.id.toLowerCase().includes(normalizedQuery))
  ));
}

export function convertCatalogPrice(
  usdValue: number | null,
  currency: CatalogCurrency,
  officialCnyValue: number | null = null,
) {
  if (currency === 'USD') return usdValue;
  if (officialCnyValue != null) return officialCnyValue;
  return usdValue == null ? null : usdValue * MODEL_CATALOG_USD_TO_CNY_RATE;
}

export function getCatalogPriceTiers(
  price: OfficialModelPrice,
  currency: CatalogCurrency,
): ReadonlyArray<CatalogPriceTier> {
  if (currency === 'USD') return price.usdTiers;
  if (price.cnyTiers.length > 0) return price.cnyTiers;
  return price.usdTiers.map((tier) => ({
    ...tier,
    input: convertCatalogPrice(tier.input, 'CNY'),
    output: convertCatalogPrice(tier.output, 'CNY'),
    cacheRead: convertCatalogPrice(tier.cacheRead ?? null, 'CNY'),
    cacheWrite: convertCatalogPrice(tier.cacheWrite ?? null, 'CNY'),
  }));
}

export function normalizeModelLookupKey(modelName: string) {
  return modelName
    .trim()
    .toLowerCase()
    .replace(/^(openai|anthropic|google|xai|x-ai|deepseek|moonshotai|moonshot-ai|kimi|zhipuai|zhipu-ai|zhipu-glm|minimax|alibaba|qwen|cohere|meta|microsoft|mistral|nvidia|tencent|xiaomi)[/:]/, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-');
}

export function calculateEffectivePrice(
  officialPrice: number | null | undefined,
  multiplier: number | null | undefined,
  creditUsdPerCny: number | null | undefined,
) {
  if (officialPrice == null || multiplier == null || !creditUsdPerCny || creditUsdPerCny <= 0) return null;
  return officialPrice * multiplier / creditUsdPerCny;
}
