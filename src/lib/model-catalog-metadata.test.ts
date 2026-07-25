import assert from 'node:assert/strict';
import test from 'node:test';
import { MODEL_PROVIDERS, OFFICIAL_MODEL_CATALOG } from './official-model-prices';
import { MODEL_CATALOG_METADATA, MODEL_CATALOG_MODELS } from './model-catalog-metadata';

const SIX_MONTH_CUTOFF = '2026-01-25';
const SNAPSHOT_DATE = '2026-07-25';

test('model directory snapshot covers the target providers and uses valid static metadata', () => {
  assert.ok(MODEL_CATALOG_MODELS.length >= 55);
  const ids = new Set<string>();
  const providers = new Set<string>();

  for (const model of MODEL_CATALOG_MODELS) {
    const key = `${model.provider}:${model.id}`;
    assert.ok(!ids.has(key), `duplicate catalog model: ${key}`);
    ids.add(key);
    providers.add(model.provider);
    assert.ok(MODEL_PROVIDERS.includes(model.provider));
    assert.ok(model.name.length > 0);
    assert.match(model.sourceProvider, /^[a-z]+$/);
    assert.doesNotMatch(model.id, /(^|-)image(?:-|$)|gpt-image|gemini-3\.1-flash-lite-preview/i);
    assert.ok(model.input.length > 0);
    assert.ok(model.input.every((item) => ['text', 'image', 'pdf', 'audio', 'video'].includes(item)));
    assert.match(model.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(model.releaseDate >= SIX_MONTH_CUTOFF && model.releaseDate <= SNAPSHOT_DATE);
    assert.ok(model.contextWindow == null || model.contextWindow > 0);
    assert.ok(model.maxOutput == null || model.maxOutput > 0);
  }

  assert.deepEqual([...providers].sort(), [...MODEL_PROVIDERS].sort());
  assert.equal(Object.keys(MODEL_CATALOG_METADATA).length, MODEL_CATALOG_MODELS.length);
});

test('model directory keeps expected recent flagship releases discoverable', () => {
  const keys = new Set(MODEL_CATALOG_MODELS.map((model) => `${model.provider}:${model.id}`));
  for (const key of ['Anthropic:claude-opus-5', 'Anthropic:claude-fable-5', 'Moonshot AI:kimi-k3', 'Zhipu AI:glm-5.2', 'MiniMax:MiniMax-M3', 'Alibaba:qwen3.8-max-preview', 'Mistral:mistral-medium-2604', 'Tencent:hy3']) {
    assert.ok(keys.has(key), `missing expected model: ${key}`);
  }
});
test('recent model directory keeps broad official price coverage', () => {
  const priceKeys = new Set(OFFICIAL_MODEL_CATALOG.map((model) => `${model.provider}:${model.id.toLowerCase().replace(/[._-]/g, '')}`));
  const pricedModels = MODEL_CATALOG_MODELS.filter((model) => priceKeys.has(`${model.provider}:${model.id.toLowerCase().replace(/[._-]/g, '')}`));
  assert.ok(pricedModels.length >= 50);
});

test('model directory excludes Xiaomi models retired from the official API', () => {
  const xiaomiIds = MODEL_CATALOG_MODELS
    .filter((model) => model.provider === 'Xiaomi')
    .map((model) => model.id);

  assert.ok(xiaomiIds.includes('mimo-v2.5'));
  assert.ok(xiaomiIds.includes('mimo-v2.5-pro'));
  assert.ok(xiaomiIds.includes('mimo-v2.5-pro-ultraspeed'));
  assert.ok(!xiaomiIds.includes('mimo-v2-pro'));
  assert.ok(!xiaomiIds.includes('mimo-v2-omni'));
});
