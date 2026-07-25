export interface ModelCatalogMetadata {
  input: string[];
  reasoning: boolean | null;
  toolCall: boolean | null;
  structured: boolean | null;
  temperature: boolean | null;
  weights: '开放' | '闭源' | null;
  releaseDate: string | null;
  updatedAt: string | null;
}

export const MODEL_CATALOG_METADATA: Readonly<Record<string, ModelCatalogMetadata>> = {
  'OpenAI:gpt-5.6-sol': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2026-07-09', updatedAt: '2026-07-09' },
  'OpenAI:gpt-5.6-terra': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2026-07-09', updatedAt: '2026-07-09' },
  'OpenAI:gpt-5.6-luna': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2026-07-09', updatedAt: '2026-07-09' },
  'OpenAI:gpt-5.5': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2026-04-23', updatedAt: '2026-04-23' },
  'OpenAI:gpt-5.5-pro': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2026-04-23', updatedAt: '2026-04-23' },
  'OpenAI:gpt-5.4': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2026-03-05', updatedAt: '2026-03-05' },
  'OpenAI:gpt-5.4-pro': { input: ['text', 'image'], reasoning: true, toolCall: true, structured: false, temperature: false, weights: '闭源', releaseDate: '2026-03-05', updatedAt: '2026-03-05' },
  'OpenAI:gpt-5.4-mini': { input: ['text', 'image'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2026-03-17', updatedAt: '2026-03-17' },
  'OpenAI:gpt-5.4-nano': { input: ['text', 'image'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2026-03-17', updatedAt: '2026-03-17' },
  'OpenAI:gpt-5.3-codex': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2026-02-05', updatedAt: '2026-02-05' },
  'OpenAI:gpt-5.2': { input: ['text', 'image'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2025-12-11', updatedAt: '2025-12-11' },
  'OpenAI:gpt-5.2-codex': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2025-12-11', updatedAt: '2025-12-11' },
  'OpenAI:gpt-5.1': { input: ['text', 'image'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2025-11-13', updatedAt: '2025-11-13' },
  'OpenAI:gpt-5': { input: ['text', 'image'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2025-08-07', updatedAt: '2025-08-07' },
  'OpenAI:gpt-5-mini': { input: ['text', 'image'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2025-08-07', updatedAt: '2025-08-07' },
  'OpenAI:gpt-5-nano': { input: ['text', 'image'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '闭源', releaseDate: '2025-08-07', updatedAt: '2025-08-07' },
  'OpenAI:gpt-4.1': { input: ['text', 'image', 'pdf'], reasoning: false, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2025-04-14', updatedAt: '2025-04-14' },
  'OpenAI:gpt-4.1-mini': { input: ['text', 'image', 'pdf'], reasoning: false, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2025-04-14', updatedAt: '2025-04-14' },
  'OpenAI:gpt-4.1-nano': { input: ['text', 'image'], reasoning: false, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2025-04-14', updatedAt: '2025-04-14' },
  'OpenAI:gpt-4o': { input: ['text', 'image', 'pdf'], reasoning: false, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2024-05-13', updatedAt: '2024-08-06' },
  'OpenAI:gpt-4o-mini': { input: ['text', 'image', 'pdf'], reasoning: false, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2024-07-18', updatedAt: '2024-07-18' },
  'Anthropic:claude-sonnet-5': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: null, temperature: false, weights: '闭源', releaseDate: '2026-06-30', updatedAt: '2026-06-30' },
  'Anthropic:claude-opus-5': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: null, temperature: false, weights: '闭源', releaseDate: '2026-07-24', updatedAt: '2026-07-24' },
  'Anthropic:claude-fable-5': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: null, temperature: false, weights: '闭源', releaseDate: '2026-06-09', updatedAt: '2026-06-09' },
  'Google:gemini-3.6-flash': { input: ['text', 'image', 'video', 'audio', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2026-07-21', updatedAt: '2026-07-21' },
  'Google:gemini-3.5-flash': { input: ['text', 'image', 'video', 'audio', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2026-05-19', updatedAt: '2026-05-19' },
  'Google:gemini-3.5-flash-lite': { input: ['text', 'image', 'video', 'audio', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2026-07-21', updatedAt: '2026-07-21' },
  'Google:gemini-3.1-pro-preview': { input: ['text', 'image', 'video', 'audio', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2026-02-19', updatedAt: '2026-02-19' },
  'Google:gemini-3.1-flash-lite': { input: ['text', 'image', 'video', 'audio', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2026-05-07', updatedAt: '2026-05-07' },
  'Google:gemini-3-flash-preview': { input: ['text', 'image', 'video', 'audio', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2025-12-17', updatedAt: '2025-12-17' },
  'xAI:grok-4.5': { input: ['text', 'image'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2026-07-08', updatedAt: '2026-07-08' },
  'xAI:grok-4.3': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2026-04-17', updatedAt: '2026-04-17' },
  'xAI:grok-4.20-0309-reasoning': { input: ['text', 'image', 'pdf'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2026-03-09', updatedAt: '2026-03-09' },
  'xAI:grok-4.20-0309-non-reasoning': { input: ['text', 'image', 'pdf'], reasoning: false, toolCall: true, structured: true, temperature: true, weights: '闭源', releaseDate: '2026-03-09', updatedAt: '2026-03-09' },
  'Kimi:kimi-k3': { input: ['text', 'image', 'video'], reasoning: true, toolCall: true, structured: true, temperature: false, weights: '开放', releaseDate: '2026-07-16', updatedAt: '2026-07-16' },
  'Zhipu GLM:glm-5.1': { input: ['text'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '开放', releaseDate: '2026-04-07', updatedAt: '2026-04-07' },
  'Zhipu GLM:glm-5': { input: ['text'], reasoning: true, toolCall: true, structured: null, temperature: true, weights: '开放', releaseDate: '2026-02-12', updatedAt: '2026-02-12' },
  'MiniMax:MiniMax-M2.7': { input: ['text'], reasoning: true, toolCall: true, structured: null, temperature: true, weights: '开放', releaseDate: '2026-03-18', updatedAt: '2026-03-18' },
  'MiniMax:MiniMax-M2.7-highspeed': { input: ['text'], reasoning: true, toolCall: true, structured: null, temperature: true, weights: '开放', releaseDate: '2026-03-18', updatedAt: '2026-03-18' },
  'DeepSeek:deepseek-v4-flash': { input: ['text'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '开放', releaseDate: '2026-04-24', updatedAt: '2026-04-24' },
  'DeepSeek:deepseek-v4-pro': { input: ['text'], reasoning: true, toolCall: true, structured: true, temperature: true, weights: '开放', releaseDate: '2026-04-24', updatedAt: '2026-04-24' },
};
