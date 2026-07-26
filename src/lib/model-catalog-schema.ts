export const SUPPORTED_MODEL_PROVIDERS = [
  'OpenAI',
  'Anthropic',
  'Google',
  'xAI',
  'DeepSeek',
  'Moonshot AI',
  'Zhipu AI',
  'MiniMax',
  'Alibaba',
  'Cohere',
  'Meta',
  'Microsoft',
  'Mistral',
  'Nvidia',
  'Tencent',
  'Xiaomi',
] as const;

export type ModelProvider = typeof SUPPORTED_MODEL_PROVIDERS[number];
export type CatalogCurrency = 'USD' | 'CNY';
export type ModelInputModality = 'text' | 'image' | 'pdf' | 'audio' | 'video';

export interface CatalogPriceTier {
  label: string;
  minInputTokens?: number;
  maxInputTokens?: number;
  input: number | null;
  output: number | null;
  cacheRead?: number | null;
  cacheWrite?: number | null;
}

export interface CatalogCurrencyPrice {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  tiers?: CatalogPriceTier[];
}

export interface CatalogPriceRecord {
  id: string;
  provider: ModelProvider;
  usd: CatalogCurrencyPrice;
  cny: CatalogCurrencyPrice;
  contextWindow: number | null;
  maxOutput: number | null;
  officialUrl: string;
  verifiedAt: string;
  usdNote?: string;
  cnyNote?: string;
}

export interface ModelCatalogEntry {
  id: string;
  sourceProvider: string;
  name: string;
  provider: ModelProvider;
  input: ModelInputModality[];
  contextWindow: number | null;
  maxOutput: number | null;
  releaseDate: string;
  priceId?: string;
}

export interface ModelCatalogDocument {
  schemaVersion: number;
  catalogVersion: string;
  updatedAt: string;
  usdToCnyRate: number;
  providers: Array<{
    name: ModelProvider;
    officialUrl: string;
  }>;
  aliases: Record<string, string>;
  prices: CatalogPriceRecord[];
  models: ModelCatalogEntry[];
}
