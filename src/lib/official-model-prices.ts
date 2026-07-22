export interface OfficialModelPrice {
  id: string;
  input: number;
  output: number;
  source: string;
  note?: string;
}

// USD / 1M Token. Snapshot updated 2026-07-22; editable prices in the UI take precedence.
const rows: Array<[string, number, number, string?]> = [
  // OpenAI
  ['gpt-5.6', 5, 30], ['gpt-5.6-sol', 5, 30], ['gpt-5.6-terra', 2.5, 15], ['gpt-5.6-luna', 1, 6],
  ['gpt-5.5', 5, 30], ['gpt-5.5-pro', 30, 180], ['gpt-5.4', 2.5, 15], ['gpt-5.4-pro', 30, 180],
  ['gpt-5.4-mini', 0.75, 4.5], ['gpt-5.4-nano', 0.2, 1.25], ['gpt-5.3-codex', 1.75, 14],
  ['gpt-5.2', 1.75, 14], ['gpt-5.2-codex', 1.75, 14], ['gpt-5.1', 1.25, 10],
  ['gpt-5', 1.25, 10], ['gpt-5-mini', 0.25, 2], ['gpt-5-nano', 0.05, 0.4],
  ['gpt-4.1', 2, 8], ['gpt-4.1-mini', 0.4, 1.6], ['gpt-4.1-nano', 0.1, 0.4],
  ['gpt-4o', 2.5, 10], ['gpt-4o-mini', 0.15, 0.6],
  // Anthropic
  ['claude-sonnet-5', 2, 10], ['claude-opus-4.8', 5, 25], ['claude-opus-4.7', 5, 25],
  ['claude-opus-4.6', 5, 25], ['claude-sonnet-4.6', 3, 15], ['claude-sonnet-4.5', 3, 15],
  ['claude-haiku-4.5', 1, 5],
  // Google
  ['gemini-3.6-flash', 1.5, 7.5], ['gemini-3.5-flash', 1.5, 9], ['gemini-3.5-flash-lite', 0.3, 2.5],
  ['gemini-3.1-pro-preview', 2, 12], ['gemini-3.1-flash-lite', 0.25, 1.5], ['gemini-3-flash-preview', 0.5, 3],
  // xAI
  ['grok-4.5', 2, 6, '超过 20 万上下文时输入 $4、输出 $12'],
  ['grok-4.3', 1.25, 2.5, '超过 20 万上下文时输入 $2.5、输出 $5'],
  ['grok-4.20-0309-reasoning', 1.25, 2.5, '超过 20 万上下文时输入 $2.5、输出 $5'],
  ['grok-4.20-0309-non-reasoning', 1.25, 2.5, '超过 20 万上下文时输入 $2.5、输出 $5'],
  // DeepSeek
  ['deepseek-chat', 0.14, 0.28], ['deepseek-reasoner', 0.14, 0.28],
  ['deepseek-v4-flash', 0.14, 0.28], ['deepseek-v4-pro', 0.435, 0.87],
];

const OFFICIAL_MODEL_PRICES: Record<string, OfficialModelPrice> = Object.fromEntries(
  rows.map(([id, input, output, note]) => [id, {
    id,
    input,
    output,
    source: '内置价格库（2026-07-22）',
    note,
  }])
);

const MODEL_ALIASES: Record<string, string> = {
  'grok4.5': 'grok-4.5',
  'grok-45': 'grok-4.5',
  'claude-sonnet-46': 'claude-sonnet-4.6',
  'claude-opus-48': 'claude-opus-4.8',
};

export function getOfficialModelPrice(modelName: string): OfficialModelPrice | null {
  const key = normalizeModelLookupKey(modelName);
  return OFFICIAL_MODEL_PRICES[MODEL_ALIASES[key] || key] || null;
}

export function normalizeModelLookupKey(modelName: string) {
  return modelName
    .trim()
    .toLowerCase()
    .replace(/^(openai|anthropic|google|xai|x-ai|deepseek)[/:]/, '')
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
