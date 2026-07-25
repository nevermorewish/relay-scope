import type { ModelProvider } from './official-model-prices';

export interface ModelCatalogModel {
  id: string;
  sourceProvider: string;
  name: string;
  provider: ModelProvider;
  input: ReadonlyArray<'text' | 'image' | 'pdf' | 'audio' | 'video'>;
  contextWindow: number | null;
  maxOutput: number | null;
  releaseDate: string;
}

// Static snapshot for the recent six-month general LLM directory. Refresh deliberately during a RelayScope release; prices remain in official-model-prices.ts.
export const MODEL_CATALOG_MODELS: ReadonlyArray<ModelCatalogModel> = [
  {
    "id": "claude-opus-5",
    "sourceProvider": "anthropic",
    "provider": "Anthropic",
    "name": "Claude Opus 5",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 128000,
    "releaseDate": "2026-07-24"
  },
  {
    "id": "gemini-3.5-flash-lite",
    "sourceProvider": "google",
    "provider": "Google",
    "name": "Gemini 3.5 Flash Lite",
    "input": [
      "text",
      "image",
      "video",
      "audio",
      "pdf"
    ],
    "contextWindow": 1048576,
    "maxOutput": 65536,
    "releaseDate": "2026-07-21"
  },
  {
    "id": "gemini-3.6-flash",
    "sourceProvider": "google",
    "provider": "Google",
    "name": "Gemini 3.6 Flash",
    "input": [
      "text",
      "image",
      "video",
      "audio",
      "pdf"
    ],
    "contextWindow": 1048576,
    "maxOutput": 65536,
    "releaseDate": "2026-07-21"
  },
  {
    "id": "qwen3.8-max-preview",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.8 Max Preview",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 1000000,
    "maxOutput": 131072,
    "releaseDate": "2026-07-19"
  },
  {
    "id": "kimi-k3",
    "sourceProvider": "moonshotai",
    "provider": "Moonshot AI",
    "name": "Kimi K3",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 1048576,
    "maxOutput": 131072,
    "releaseDate": "2026-07-16"
  },
  {
    "id": "gpt-5.6-luna",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.6 Luna",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1050000,
    "maxOutput": 128000,
    "releaseDate": "2026-07-09"
  },
  {
    "id": "gpt-5.6-sol",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.6 Sol",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1050000,
    "maxOutput": 128000,
    "releaseDate": "2026-07-09"
  },
  {
    "id": "gpt-5.6-terra",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.6 Terra",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1050000,
    "maxOutput": 128000,
    "releaseDate": "2026-07-09"
  },
  {
    "id": "grok-4.5",
    "sourceProvider": "xai",
    "provider": "xAI",
    "name": "Grok 4.5",
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 500000,
    "maxOutput": 500000,
    "releaseDate": "2026-07-08"
  },
  {
    "id": "hy3",
    "sourceProvider": "tencent",
    "provider": "Tencent",
    "name": "Hy3",
    "input": [
      "text"
    ],
    "contextWindow": 256000,
    "maxOutput": 64000,
    "releaseDate": "2026-07-06"
  },
  {
    "id": "claude-sonnet-5",
    "sourceProvider": "anthropic",
    "provider": "Anthropic",
    "name": "Claude Sonnet 5",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 128000,
    "releaseDate": "2026-06-30"
  },
  {
    "id": "glm-5.2",
    "sourceProvider": "zhipuai",
    "provider": "Zhipu AI",
    "name": "GLM-5.2",
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutput": 131072,
    "releaseDate": "2026-06-13"
  },
  {
    "id": "kimi-k2.7-code",
    "sourceProvider": "moonshotai",
    "provider": "Moonshot AI",
    "name": "Kimi K2.7 Code",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 262144,
    "maxOutput": 262144,
    "releaseDate": "2026-06-12"
  },
  {
    "id": "kimi-k2.7-code-highspeed",
    "sourceProvider": "moonshotai",
    "provider": "Moonshot AI",
    "name": "Kimi K2.7 Code Highspeed",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 262144,
    "maxOutput": 262144,
    "releaseDate": "2026-06-12"
  },
  {
    "id": "claude-fable-5",
    "sourceProvider": "anthropic",
    "provider": "Anthropic",
    "name": "Claude Fable 5",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 128000,
    "releaseDate": "2026-06-09"
  },
  {
    "id": "north-mini-code-1-0",
    "sourceProvider": "cohere",
    "provider": "Cohere",
    "name": "North Mini Code",
    "input": [
      "text"
    ],
    "contextWindow": 256000,
    "maxOutput": 64000,
    "releaseDate": "2026-06-09"
  },
  {
    "id": "mimo-v2.5-pro-ultraspeed",
    "sourceProvider": "xiaomi",
    "provider": "Xiaomi",
    "name": "MiMo-V2.5-Pro-UltraSpeed",
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutput": 131072,
    "releaseDate": "2026-06-08"
  },
  {
    "id": "nemotron-3-ultra-550b-a55b",
    "sourceProvider": "nvidia",
    "provider": "Nvidia",
    "name": "Nemotron 3 Ultra 550B A55B",
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutput": 128000,
    "releaseDate": "2026-06-04"
  },
  {
    "id": "qwen3.7-plus",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.7 Plus",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 1000000,
    "maxOutput": 64000,
    "releaseDate": "2026-06-02"
  },
  {
    "id": "mai-code-1-flash",
    "sourceProvider": "microsoft",
    "provider": "Microsoft",
    "name": "MAI-Code-1-Flash",
    "input": [
      "text"
    ],
    "contextWindow": 256000,
    "maxOutput": 128000,
    "releaseDate": "2026-06-02"
  },
  {
    "id": "MiniMax-M3",
    "sourceProvider": "minimax",
    "provider": "MiniMax",
    "name": "MiniMax-M3",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 512000,
    "maxOutput": 128000,
    "releaseDate": "2026-06-01"
  },
  {
    "id": "claude-opus-4-8",
    "sourceProvider": "anthropic",
    "provider": "Anthropic",
    "name": "Claude Opus 4.8",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 128000,
    "releaseDate": "2026-05-28"
  },
  {
    "id": "qwen3.7-max",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.7 Max",
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutput": 65536,
    "releaseDate": "2026-05-21"
  },
  {
    "id": "command-a-plus-05-2026",
    "sourceProvider": "cohere",
    "provider": "Cohere",
    "name": "Command A Plus",
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 128000,
    "maxOutput": 64000,
    "releaseDate": "2026-05-20"
  },
  {
    "id": "gemini-3.5-flash",
    "sourceProvider": "google",
    "provider": "Google",
    "name": "Gemini 3.5 Flash",
    "input": [
      "text",
      "image",
      "video",
      "audio",
      "pdf"
    ],
    "contextWindow": 1048576,
    "maxOutput": 65536,
    "releaseDate": "2026-05-19"
  },
  {
    "id": "gemini-3.1-flash-lite",
    "sourceProvider": "google",
    "provider": "Google",
    "name": "Gemini 3.1 Flash Lite",
    "input": [
      "text",
      "image",
      "video",
      "audio",
      "pdf"
    ],
    "contextWindow": 1048576,
    "maxOutput": 65536,
    "releaseDate": "2026-05-07"
  },
  {
    "id": "gpt-5.5-instant",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.5 Instant",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 400000,
    "maxOutput": 128000,
    "releaseDate": "2026-05-05"
  },
  {
    "id": "mistral-medium-2604",
    "sourceProvider": "mistral",
    "provider": "Mistral",
    "name": "Mistral Medium 3.5",
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutput": 262144,
    "releaseDate": "2026-04-29"
  },
  {
    "id": "nemotron-3-nano-omni-30b-a3b-reasoning",
    "sourceProvider": "nvidia",
    "provider": "Nvidia",
    "name": "Nemotron 3 Nano Omni 30B A3B Reasoning",
    "input": [
      "text",
      "image",
      "video",
      "audio"
    ],
    "contextWindow": 256000,
    "maxOutput": 65536,
    "releaseDate": "2026-04-28"
  },
  {
    "id": "qwen3.6-flash",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.6 Flash",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 1000000,
    "maxOutput": 65536,
    "releaseDate": "2026-04-27"
  },
  {
    "id": "deepseek-v4-flash",
    "sourceProvider": "deepseek",
    "provider": "DeepSeek",
    "name": "DeepSeek V4 Flash",
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutput": 384000,
    "releaseDate": "2026-04-24"
  },
  {
    "id": "deepseek-v4-pro",
    "sourceProvider": "deepseek",
    "provider": "DeepSeek",
    "name": "DeepSeek V4 Pro",
    "input": [
      "text"
    ],
    "contextWindow": 1000000,
    "maxOutput": 384000,
    "releaseDate": "2026-04-24"
  },
  {
    "id": "gpt-5.5",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.5",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1050000,
    "maxOutput": 128000,
    "releaseDate": "2026-04-23"
  },
  {
    "id": "gpt-5.5-pro",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.5 Pro",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1050000,
    "maxOutput": 128000,
    "releaseDate": "2026-04-23"
  },
  {
    "id": "qwen3.6-27b",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.6 27B",
    "input": [
      "text",
      "image",
      "video",
      "audio"
    ],
    "contextWindow": 262144,
    "maxOutput": 65536,
    "releaseDate": "2026-04-22"
  },
  {
    "id": "mimo-v2.5",
    "sourceProvider": "xiaomi",
    "provider": "Xiaomi",
    "name": "MiMo-V2.5",
    "input": [
      "text",
      "image",
      "audio",
      "video"
    ],
    "contextWindow": 1048576,
    "maxOutput": 131072,
    "releaseDate": "2026-04-22"
  },
  {
    "id": "mimo-v2.5-pro",
    "sourceProvider": "xiaomi",
    "provider": "Xiaomi",
    "name": "MiMo-V2.5-Pro",
    "input": [
      "text"
    ],
    "contextWindow": 1048576,
    "maxOutput": 131072,
    "releaseDate": "2026-04-22"
  },
  {
    "id": "kimi-k2.6",
    "sourceProvider": "moonshotai",
    "provider": "Moonshot AI",
    "name": "Kimi K2.6",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 262144,
    "maxOutput": 262144,
    "releaseDate": "2026-04-21"
  },
  {
    "id": "qwen3.6-max-preview",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.6 Max Preview",
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutput": 65536,
    "releaseDate": "2026-04-20"
  },
  {
    "id": "hy3-preview",
    "sourceProvider": "tencent",
    "provider": "Tencent",
    "name": "Hy3 preview",
    "input": [
      "text"
    ],
    "contextWindow": 256000,
    "maxOutput": 64000,
    "releaseDate": "2026-04-20"
  },
  {
    "id": "qwen3.6-35b-a3b",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.6 35B-A3B",
    "input": [
      "text",
      "image",
      "video",
      "audio"
    ],
    "contextWindow": 262144,
    "maxOutput": 65536,
    "releaseDate": "2026-04-17"
  },
  {
    "id": "grok-4.3",
    "sourceProvider": "xai",
    "provider": "xAI",
    "name": "Grok 4.3",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 30000,
    "releaseDate": "2026-04-17"
  },
  {
    "id": "claude-opus-4-7",
    "sourceProvider": "anthropic",
    "provider": "Anthropic",
    "name": "Claude Opus 4.7",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 128000,
    "releaseDate": "2026-04-16"
  },
  {
    "id": "grok-build-0.1",
    "sourceProvider": "xai",
    "provider": "xAI",
    "name": "Grok Build 0.1",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 256000,
    "maxOutput": 256000,
    "releaseDate": "2026-04-16"
  },
  {
    "id": "muse-spark-1.1",
    "sourceProvider": "meta",
    "provider": "Meta",
    "name": "Muse Spark 1.1",
    "input": [
      "text",
      "image",
      "pdf",
      "video"
    ],
    "contextWindow": 1000000,
    "maxOutput": 32000,
    "releaseDate": "2026-04-08"
  },
  {
    "id": "glm-5.1",
    "sourceProvider": "zhipuai",
    "provider": "Zhipu AI",
    "name": "GLM-5.1",
    "input": [
      "text"
    ],
    "contextWindow": 200000,
    "maxOutput": 131072,
    "releaseDate": "2026-04-07"
  },
  {
    "id": "qwen3.6-plus",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.6 Plus",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 1000000,
    "maxOutput": 65536,
    "releaseDate": "2026-04-02"
  },
  {
    "id": "gemma-4-26b-a4b-it",
    "sourceProvider": "google",
    "provider": "Google",
    "name": "Gemma 4 26B A4B IT",
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutput": 32768,
    "releaseDate": "2026-04-02"
  },
  {
    "id": "gemma-4-31b-it",
    "sourceProvider": "google",
    "provider": "Google",
    "name": "Gemma 4 31B IT",
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 262144,
    "maxOutput": 32768,
    "releaseDate": "2026-04-02"
  },
  {
    "id": "gemma-4-E2B-it",
    "sourceProvider": "google",
    "provider": "Google",
    "name": "Gemma 4 E2B IT",
    "input": [
      "text",
      "image",
      "audio"
    ],
    "contextWindow": 131072,
    "maxOutput": 8192,
    "releaseDate": "2026-04-02"
  },
  {
    "id": "gemma-4-E4B-it",
    "sourceProvider": "google",
    "provider": "Google",
    "name": "Gemma 4 E4B IT",
    "input": [
      "text",
      "image",
      "audio"
    ],
    "contextWindow": 131072,
    "maxOutput": 8192,
    "releaseDate": "2026-04-02"
  },
  {
    "id": "glm-5v-turbo",
    "sourceProvider": "zhipuai",
    "provider": "Zhipu AI",
    "name": "GLM-5V-Turbo",
    "input": [
      "text",
      "image",
      "video",
      "pdf"
    ],
    "contextWindow": 200000,
    "maxOutput": 131072,
    "releaseDate": "2026-04-01"
  },
  {
    "id": "nemotron-cascade-2-30b-a3b",
    "sourceProvider": "nvidia",
    "provider": "Nvidia",
    "name": "Nemotron Cascade 2 30B A3B",
    "input": [
      "text"
    ],
    "contextWindow": 256000,
    "maxOutput": 32768,
    "releaseDate": "2026-03-24"
  },
  {
    "id": "MiniMax-M2.7",
    "sourceProvider": "minimax",
    "provider": "MiniMax",
    "name": "MiniMax-M2.7",
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutput": 131072,
    "releaseDate": "2026-03-18"
  },
  {
    "id": "MiniMax-M2.7-highspeed",
    "sourceProvider": "minimax",
    "provider": "MiniMax",
    "name": "MiniMax-M2.7-highspeed",
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutput": 131072,
    "releaseDate": "2026-03-18"
  },
  {
    "id": "gpt-5.4-mini",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.4 mini",
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxOutput": 128000,
    "releaseDate": "2026-03-17"
  },
  {
    "id": "gpt-5.4-nano",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.4 nano",
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 400000,
    "maxOutput": 128000,
    "releaseDate": "2026-03-17"
  },
  {
    "id": "mistral-small-2603",
    "sourceProvider": "mistral",
    "provider": "Mistral",
    "name": "Mistral Small 4",
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 256000,
    "maxOutput": 256000,
    "releaseDate": "2026-03-16"
  },
  {
    "id": "glm-5-turbo",
    "sourceProvider": "zhipuai",
    "provider": "Zhipu AI",
    "name": "GLM-5-Turbo",
    "input": [
      "text"
    ],
    "contextWindow": 200000,
    "maxOutput": 131072,
    "releaseDate": "2026-03-16"
  },
  {
    "id": "nemotron-3-super-120b-a12b",
    "sourceProvider": "nvidia",
    "provider": "Nvidia",
    "name": "Nemotron 3 Super 120B A12B",
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutput": 262144,
    "releaseDate": "2026-03-11"
  },
  {
    "id": "grok-4.20-0309-non-reasoning",
    "sourceProvider": "xai",
    "provider": "xAI",
    "name": "Grok 4.20 (Non-Reasoning)",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 30000,
    "releaseDate": "2026-03-09"
  },
  {
    "id": "grok-4.20-0309-reasoning",
    "sourceProvider": "xai",
    "provider": "xAI",
    "name": "Grok 4.20 (Reasoning)",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 30000,
    "releaseDate": "2026-03-09"
  },
  {
    "id": "gpt-5.4",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.4",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1050000,
    "maxOutput": 128000,
    "releaseDate": "2026-03-05"
  },
  {
    "id": "gpt-5.4-pro",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.4 Pro",
    "input": [
      "text",
      "image"
    ],
    "contextWindow": 1050000,
    "maxOutput": 128000,
    "releaseDate": "2026-03-05"
  },
  {
    "id": "qwen3.5-122b-a10b",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.5 122B-A10B",
    "input": [
      "text",
      "image",
      "video",
      "audio"
    ],
    "contextWindow": 262144,
    "maxOutput": 65536,
    "releaseDate": "2026-02-23"
  },
  {
    "id": "qwen3.5-27b",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.5 27B",
    "input": [
      "text",
      "image",
      "video",
      "audio"
    ],
    "contextWindow": 262144,
    "maxOutput": 65536,
    "releaseDate": "2026-02-23"
  },
  {
    "id": "qwen3.5-35b-a3b",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.5 35B-A3B",
    "input": [
      "text",
      "image",
      "video",
      "audio"
    ],
    "contextWindow": 262144,
    "maxOutput": 65536,
    "releaseDate": "2026-02-23"
  },
  {
    "id": "qwen3.5-9b",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.5 9B",
    "input": [
      "text"
    ],
    "contextWindow": 262144,
    "maxOutput": 65536,
    "releaseDate": "2026-02-23"
  },
  {
    "id": "gemini-3.1-pro-preview",
    "sourceProvider": "google",
    "provider": "Google",
    "name": "Gemini 3.1 Pro Preview",
    "input": [
      "text",
      "image",
      "video",
      "audio",
      "pdf"
    ],
    "contextWindow": 1048576,
    "maxOutput": 65536,
    "releaseDate": "2026-02-19"
  },
  {
    "id": "claude-sonnet-4-6",
    "sourceProvider": "anthropic",
    "provider": "Anthropic",
    "name": "Claude Sonnet 4.6",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 64000,
    "releaseDate": "2026-02-17"
  },
  {
    "id": "qwen3.5-plus",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.5 Plus",
    "input": [
      "text",
      "image",
      "video"
    ],
    "contextWindow": 1000000,
    "maxOutput": 65536,
    "releaseDate": "2026-02-16"
  },
  {
    "id": "qwen3.5-397b-a17b",
    "sourceProvider": "alibaba",
    "provider": "Alibaba",
    "name": "Qwen3.5 397B-A17B",
    "input": [
      "text",
      "image",
      "video",
      "audio"
    ],
    "contextWindow": 262144,
    "maxOutput": 65536,
    "releaseDate": "2026-02-15"
  },
  {
    "id": "MiniMax-M2.5-highspeed",
    "sourceProvider": "minimax",
    "provider": "MiniMax",
    "name": "MiniMax-M2.5-highspeed",
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutput": 131072,
    "releaseDate": "2026-02-13"
  },
  {
    "id": "MiniMax-M2.5",
    "sourceProvider": "minimax",
    "provider": "MiniMax",
    "name": "MiniMax-M2.5",
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutput": 131072,
    "releaseDate": "2026-02-12"
  },
  {
    "id": "glm-5",
    "sourceProvider": "zhipuai",
    "provider": "Zhipu AI",
    "name": "GLM-5",
    "input": [
      "text"
    ],
    "contextWindow": 204800,
    "maxOutput": 131072,
    "releaseDate": "2026-02-12"
  },
  {
    "id": "claude-opus-4-6",
    "sourceProvider": "anthropic",
    "provider": "Anthropic",
    "name": "Claude Opus 4.6",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 1000000,
    "maxOutput": 128000,
    "releaseDate": "2026-02-05"
  },
  {
    "id": "gpt-5.3-codex",
    "sourceProvider": "openai",
    "provider": "OpenAI",
    "name": "GPT-5.3 Codex",
    "input": [
      "text",
      "image",
      "pdf"
    ],
    "contextWindow": 400000,
    "maxOutput": 128000,
    "releaseDate": "2026-02-05"
  }
] as const;

export const MODEL_CATALOG_METADATA: Readonly<Record<string, Pick<ModelCatalogModel, 'input' | 'releaseDate'>>> = Object.fromEntries(
  MODEL_CATALOG_MODELS.map((model) => [`${model.provider}:${model.id}`, { input: model.input, releaseDate: model.releaseDate }]),
);
