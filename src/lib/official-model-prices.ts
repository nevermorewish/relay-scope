export const MODEL_PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'xAI', 'DeepSeek', 'Moonshot AI', 'Zhipu AI', 'MiniMax', 'Alibaba', 'Cohere', 'Meta', 'Microsoft', 'Mistral', 'Nvidia', 'Tencent', 'Xiaomi'] as const;
export const MODEL_CATALOG_USD_TO_CNY_RATE = 7.2;

export type ModelProvider = typeof MODEL_PROVIDERS[number];
export type CatalogCurrency = 'USD' | 'CNY';

export interface OfficialModelPrice {
  id: string;
  provider: ModelProvider;
  input: number;
  output: number;
  cacheRead: number | null;
  cacheWrite: number | null;
  contextWindow: number | null;
  maxOutput: number | null;
  officialUrl: string;
  source: string;
  verifiedAt: string;
  note?: string;
}

type CatalogRow = Omit<OfficialModelPrice, 'source'>;

export const MODEL_PROVIDER_OFFICIAL_URLS: Readonly<Record<ModelProvider, string>> = {
  OpenAI: 'https://openai.com/zh-Hans/api/pricing/',
  Anthropic: 'https://docs.anthropic.com/zh-CN/docs/about-claude/pricing',
  Google: 'https://ai.google.dev/gemini-api/docs/pricing?hl=zh-cn',
  xAI: 'https://docs.x.ai/developers/models',
  DeepSeek: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
  'Moonshot AI': 'https://platform.kimi.com/docs/pricing/chat',
  'Zhipu AI': 'https://www.bigmodel.cn/pricing',
  MiniMax: 'https://platform.minimaxi.com/docs/guides/pricing-paygo',
  Alibaba: 'https://help.aliyun.com/zh/model-studio/model-pricing',
  Cohere: 'https://docs.cohere.com/docs/models',
  Meta: 'https://www.llama.com/models/',
  Microsoft: 'https://azure.microsoft.com/zh-cn/products/ai-foundry/models',
  Mistral: 'https://docs.mistral.ai/getting-started/models/',
  Nvidia: 'https://build.nvidia.com/explore/discover',
  Tencent: 'https://cloud.tencent.com/document/product/1729',
  Xiaomi: 'https://platform.xiaomimimo.com/docs',
};

function row(
  provider: ModelProvider,
  id: string,
  input: number,
  output: number,
  options: Partial<Pick<CatalogRow, 'cacheRead' | 'cacheWrite' | 'contextWindow' | 'maxOutput' | 'officialUrl' | 'verifiedAt' | 'note'>> = {},
): OfficialModelPrice {
  const verifiedAt = options.verifiedAt ?? (provider === 'xAI' ? '2026-07-22' : '2026-07-25');
  return {
    id,
    provider,
    input,
    output,
    cacheRead: options.cacheRead ?? null,
    cacheWrite: options.cacheWrite ?? null,
    contextWindow: options.contextWindow ?? null,
    maxOutput: options.maxOutput ?? null,
    officialUrl: options.officialUrl ?? MODEL_PROVIDER_OFFICIAL_URLS[provider],
    verifiedAt,
    note: options.note,
    source: `官方价格目录（${verifiedAt} 核验）`,
  };
}

// USD / 1M Token. Base/standard API tier only; conditional tiers are described in note.
export const OFFICIAL_MODEL_CATALOG: ReadonlyArray<OfficialModelPrice> = [
  row('OpenAI', 'gpt-5.6-sol', 5, 30, { cacheRead: 0.5, cacheWrite: 6.25, contextWindow: 1_050_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5.6-terra', 2.5, 15, { cacheRead: 0.25, cacheWrite: 3.125, contextWindow: 1_050_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5.6-luna', 1, 6, { cacheRead: 0.1, cacheWrite: 1.25, contextWindow: 1_050_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5.5', 5, 30, { cacheRead: 0.5, contextWindow: 1_050_000, maxOutput: 128_000, note: '主表展示低于 272K 上下文的标准价格；长上下文请求价格更高。' }),
  row('OpenAI', 'gpt-5.5-pro', 30, 180, { contextWindow: 1_050_000, maxOutput: 128_000, note: '主表展示低于 272K 上下文的标准价格；长上下文请求价格更高。' }),
  row('OpenAI', 'gpt-5.4', 2.5, 15, { cacheRead: 0.25, contextWindow: 1_050_000, maxOutput: 128_000, note: '主表展示低于 272K 上下文的标准价格；长上下文请求价格更高。' }),
  row('OpenAI', 'gpt-5.4-pro', 30, 180, { contextWindow: 1_050_000, maxOutput: 128_000, note: '主表展示低于 272K 上下文的标准价格；长上下文请求价格更高。' }),
  row('OpenAI', 'gpt-5.4-mini', 0.75, 4.5, { cacheRead: 0.075, contextWindow: 400_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5.4-nano', 0.2, 1.25, { cacheRead: 0.02, contextWindow: 400_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5.3-codex', 1.75, 14, { contextWindow: 400_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5.2', 1.75, 14, { contextWindow: 400_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5.2-codex', 1.75, 14, { contextWindow: 400_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5.1', 1.25, 10, { cacheRead: 0.125, contextWindow: 400_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5', 1.25, 10, { cacheRead: 0.125, contextWindow: 400_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5-mini', 0.25, 2, { cacheRead: 0.025, contextWindow: 400_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-5-nano', 0.05, 0.4, { cacheRead: 0.005, contextWindow: 400_000, maxOutput: 128_000 }),
  row('OpenAI', 'gpt-4.1', 2, 8, { cacheRead: 0.5, contextWindow: 1_047_576, maxOutput: 32_768 }),
  row('OpenAI', 'gpt-4.1-mini', 0.4, 1.6, { cacheRead: 0.1, contextWindow: 1_047_576, maxOutput: 32_768 }),
  row('OpenAI', 'gpt-4.1-nano', 0.1, 0.4, { cacheRead: 0.025, contextWindow: 1_047_576, maxOutput: 32_768 }),
  row('OpenAI', 'gpt-4o', 2.5, 10, { cacheRead: 1.25, contextWindow: 128_000, maxOutput: 16_384 }),
  row('OpenAI', 'gpt-4o-mini', 0.15, 0.6, { cacheRead: 0.075, contextWindow: 128_000, maxOutput: 16_384 }),

  row('Anthropic', 'claude-sonnet-5', 2, 10, { cacheRead: 0.2, cacheWrite: 2.5, contextWindow: 1_000_000, maxOutput: 128_000 }),
  row('Anthropic', 'claude-opus-5', 5, 25, { cacheRead: 0.5, cacheWrite: 6.25, contextWindow: 1_000_000, maxOutput: 128_000 }),
  row('Anthropic', 'claude-fable-5', 10, 50, { cacheRead: 1, cacheWrite: 12.5, contextWindow: 1_000_000, maxOutput: 128_000 }),
  row('Anthropic', 'claude-opus-4.8', 5, 25, { cacheRead: 0.5, cacheWrite: 6.25, contextWindow: 1_000_000, maxOutput: 128_000 }),
  row('Anthropic', 'claude-opus-4.7', 5, 25, { cacheRead: 0.5, cacheWrite: 6.25, contextWindow: 1_000_000, maxOutput: 128_000 }),
  row('Anthropic', 'claude-opus-4.6', 5, 25, { cacheRead: 0.5, cacheWrite: 6.25, contextWindow: 1_000_000, maxOutput: 128_000 }),
  row('Anthropic', 'claude-sonnet-4.6', 3, 15, { cacheRead: 0.3, cacheWrite: 3.75, contextWindow: 1_000_000, maxOutput: 64_000 }),
  row('Anthropic', 'claude-sonnet-4.5', 3, 15, { cacheRead: 0.3, cacheWrite: 3.75, contextWindow: 1_000_000, maxOutput: 64_000 }),
  row('Anthropic', 'claude-haiku-4.5', 1, 5, { cacheRead: 0.1, cacheWrite: 1.25, contextWindow: 200_000, maxOutput: 64_000 }),

  row('Google', 'gemini-3.6-flash', 1.5, 7.5, { cacheRead: 0.15, contextWindow: 1_000_000, maxOutput: 65_536, note: '缓存存储另收 $1 / 100 万 Token / 小时。' }),
  row('Google', 'gemini-3.5-flash', 1.5, 9, { cacheRead: 0.15, contextWindow: 1_000_000, maxOutput: 65_536, note: '缓存存储另收 $1 / 100 万 Token / 小时。' }),
  row('Google', 'gemini-3.5-flash-lite', 0.3, 2.5, { cacheRead: 0.03, contextWindow: 1_000_000, maxOutput: 65_536, note: '缓存存储另收 $1 / 100 万 Token / 小时。' }),
  row('Google', 'gemini-3.1-pro-preview', 2, 12, { cacheRead: 0.2, contextWindow: 1_000_000, maxOutput: 65_536, note: '主表展示不超过 200K 输入 Token 的价格；更长输入采用更高档价格。缓存存储另收 $4.5 / 100 万 Token / 小时。' }),
  row('Google', 'gemini-3.1-flash-lite', 0.25, 1.5, { cacheRead: 0.025, contextWindow: 1_000_000, maxOutput: 65_536, note: '主表展示文本、图片和视频价格；音频输入及缓存价格更高。缓存存储另收 $1 / 100 万 Token / 小时。' }),
  row('Google', 'gemini-3-flash-preview', 0.5, 3, { cacheRead: 0.05, contextWindow: 1_000_000, maxOutput: 65_536, note: '主表展示文本、图片和视频价格；音频输入及缓存价格更高。缓存存储另收 $1 / 100 万 Token / 小时。' }),

  row('xAI', 'grok-4.5', 2, 6, { contextWindow: 2_000_000, maxOutput: 128_000, note: '超过 20 万上下文时输入 $4、输出 $12。' }),
  row('xAI', 'grok-4.3', 1.25, 2.5, { contextWindow: 2_000_000, maxOutput: 128_000, note: '超过 20 万上下文时输入 $2.5、输出 $5。' }),
  row('xAI', 'grok-4.20-0309-reasoning', 1.25, 2.5, { contextWindow: 2_000_000, maxOutput: 128_000, note: '超过 20 万上下文时输入 $2.5、输出 $5。' }),
  row('xAI', 'grok-4.20-0309-non-reasoning', 1.25, 2.5, { contextWindow: 2_000_000, maxOutput: 128_000, note: '超过 20 万上下文时输入 $2.5、输出 $5。' }),
  row('xAI', 'grok-build-0.1', 1, 2, { cacheRead: 0.2, contextWindow: 256_000, maxOutput: 256_000, note: '超过 20 万上下文时输入 $2、缓存读取 $0.4、输出 $4。' }),

  row('Moonshot AI', 'kimi-k3', 3, 15, { cacheRead: 0.3, contextWindow: 1_000_000, maxOutput: 131_072 }),
  row('Moonshot AI', 'kimi-k2.6', 0.95, 4, { cacheRead: 0.16, contextWindow: 262_144, maxOutput: 262_144 }),
  row('Moonshot AI', 'kimi-k2.7-code', 0.95, 4, { cacheRead: 0.19, contextWindow: 262_144, maxOutput: 262_144 }),
  row('Zhipu AI', 'glm-5.1', 1.4, 4.4, { cacheRead: 0.26, contextWindow: 200_000, maxOutput: 131_072 }),
  row('Zhipu AI', 'glm-5', 1, 3.2, { cacheRead: 0.2, contextWindow: 204_800, maxOutput: 131_072 }),
  row('Zhipu AI', 'glm-5.2', 1.4, 4.4, { cacheRead: 0.26, contextWindow: 1_000_000, maxOutput: 131_072 }),
  row('Zhipu AI', 'glm-5-turbo', 1.2, 4, { cacheRead: 0.24, contextWindow: 200_000, maxOutput: 131_072 }),
  row('Zhipu AI', 'glm-5v-turbo', 1.2, 4, { cacheRead: 0.24, contextWindow: 200_000, maxOutput: 131_072 }),
  row('MiniMax', 'MiniMax-M2.7', 0.3, 1.2, { cacheRead: 0.06, cacheWrite: 0.375, contextWindow: 204_800, maxOutput: 131_072 }),
  row('MiniMax', 'MiniMax-M2.7-highspeed', 0.6, 2.4, { cacheRead: 0.06, cacheWrite: 0.375, contextWindow: 204_800, maxOutput: 131_072 }),
  row('MiniMax', 'MiniMax-M3', 0.6, 2.4, { cacheRead: 0.12, contextWindow: 512_000, maxOutput: 128_000, note: '主表展示不超过 512K 输入 Token 的官方标准价；官方页面同时列出优惠价和长上下文档位。' }),
  row('MiniMax', 'MiniMax-M2.5', 0.3, 1.2, { cacheRead: 0.03, cacheWrite: 0.375, contextWindow: 204_800, maxOutput: 131_072 }),
  row('MiniMax', 'MiniMax-M2.5-highspeed', 0.6, 2.4, { cacheRead: 0.03, cacheWrite: 0.375, contextWindow: 204_800, maxOutput: 131_072 }),
  row('Alibaba', 'qwen3.7-max-2026-05-17', 2.5, 7.5, { contextWindow: 1_000_000, maxOutput: 65_536 }),
  row('Alibaba', 'qwen3.7-max', 2.5, 7.5, { contextWindow: 1_000_000, maxOutput: 65_536 }),
  row('Alibaba', 'qwen3.7-plus', 1.6, 1.6, { cacheRead: 0.4, contextWindow: 1_000_000, maxOutput: 64_000 }),
  row('Alibaba', 'qwen3.6-flash', 1.5, 1.5, { cacheRead: 0.25, contextWindow: 1_000_000, maxOutput: 65_536, note: '主表展示不超过 256K 输入 Token 的国际标准价；长上下文价格更高。' }),
  row('Alibaba', 'qwen3.6-27b', 3.6, 3.6, { cacheRead: 0.6, contextWindow: 262_144, maxOutput: 65_536 }),
  row('Alibaba', 'qwen3.6-max-preview', 1.3, 7.8, { contextWindow: 262_144, maxOutput: 65_536, note: '主表展示不超过 128K 输入 Token 的国际标准价。' }),
  row('Alibaba', 'qwen3.6-35b-a3b', 2.25, 2.25, { cacheRead: 0.375, contextWindow: 262_144, maxOutput: 65_536 }),
  row('Alibaba', 'qwen3.6-plus', 3, 3, { cacheRead: 0.5, contextWindow: 1_000_000, maxOutput: 65_536 }),
  row('Alibaba', 'qwen3.5-122b-a10b', 3.2, 3.2, { cacheRead: 0.4, contextWindow: 262_144, maxOutput: 65_536 }),
  row('Alibaba', 'qwen3.5-27b', 2.4, 2.4, { cacheRead: 0.3, contextWindow: 262_144, maxOutput: 65_536 }),
  row('Alibaba', 'qwen3.5-35b-a3b', 2, 2, { cacheRead: 0.25, contextWindow: 262_144, maxOutput: 65_536 }),
  row('Alibaba', 'qwen3.5-plus', 2.4, 2.4, { cacheRead: 0.4, contextWindow: 1_000_000, maxOutput: 65_536 }),
  row('Alibaba', 'qwen3.5-397b-a17b', 3.6, 3.6, { cacheRead: 0.6, contextWindow: 262_144, maxOutput: 65_536 }),
  row('Microsoft', 'mai-code-1-flash', 1.1, 4.4, {
    contextWindow: 256_000,
    maxOutput: 128_000,
    officialUrl: 'https://ai.azure.com/catalog/models/mai-code-1-flash',
    note: 'Azure AI 模型目录提供的参考价格；实际价格可能随使用方式和部署配置变化。',
  }),
  row('Xiaomi', 'mimo-v2.5', 0.14, 0.28, { cacheRead: 0.0028, contextWindow: 1_048_576, maxOutput: 131_072 }),
  row('Xiaomi', 'mimo-v2.5-pro', 0.435, 0.87, { cacheRead: 0.0036, contextWindow: 1_048_576, maxOutput: 131_072 }),
  row('Xiaomi', 'mimo-v2.5-pro-ultraspeed', 1.305, 2.61, { cacheRead: 0.0108, contextWindow: 1_048_576, maxOutput: 131_072 }),
  row('Mistral', 'mistral-small-2603', 0.15, 0.6, { contextWindow: 256_000, maxOutput: 64_000 }),
  row('Mistral', 'mistral-medium-3-5', 1.5, 7.5, { contextWindow: 256_000, maxOutput: 64_000, note: '对应 26.04 版本；资料目录使用的发布 ID 为 mistral-medium-2604。' }),
  row('DeepSeek', 'deepseek-v4-flash', 0.14, 0.28, { cacheRead: 0.0028, contextWindow: 1_000_000, maxOutput: 384_000 }),
  row('DeepSeek', 'deepseek-v4-pro', 0.435, 0.87, { cacheRead: 0.003625, contextWindow: 1_000_000, maxOutput: 384_000 }),
];

const OFFICIAL_MODEL_PRICES: Readonly<Record<string, OfficialModelPrice>> = Object.fromEntries(
  OFFICIAL_MODEL_CATALOG.map((model) => [model.id, model])
);

const MODEL_ALIASES: Record<string, string> = {
  'gpt-5.6': 'gpt-5.6-sol',
  'grok4.5': 'grok-4.5',
  'grok-45': 'grok-4.5',
  'claude-sonnet-46': 'claude-sonnet-4.6',
  'claude-opus-48': 'claude-opus-4.8',
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-flash',
  'mistral-medium-2604': 'mistral-medium-3-5',
};

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

export function convertCatalogPrice(value: number | null, currency: CatalogCurrency) {
  if (value == null || currency === 'USD') return value;
  return value * MODEL_CATALOG_USD_TO_CNY_RATE;
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
