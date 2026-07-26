import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MODEL_PROVIDERS,
  MODEL_CATALOG_VERSION,
  OFFICIAL_MODEL_CATALOG,
  calculateEffectivePrice,
  convertCatalogPrice,
  filterOfficialModelCatalog,
  getCatalogPriceTiers,
  getOfficialModelPrice,
  normalizeModelLookupKey,
} from './official-model-prices';
import { normalizeMonitoredModels } from './monitored-models';

test('calculates effective CNY prices from official price, multiplier, and recharge credit', () => {
  assert.equal(calculateEffectivePrice(2, 0.03, 1), 0.06);
  assert.equal(calculateEffectivePrice(2, 0.03, 10), 0.006);
  assert.equal(calculateEffectivePrice(2, null, 1), null);
});

test('fills known official prices and keeps distinct monitored models', () => {
  const models = normalizeMonitoredModels([
    { modelName: 'gpt-4o-mini', enabled: true },
    { modelName: 'custom-model', officialInputPrice: 3, officialOutputPrice: 9 },
    { modelName: 'custom-model', officialInputPrice: 99 },
  ]);

  assert.equal(models.length, 2);
  assert.equal(models[0].officialInputPrice, getOfficialModelPrice('gpt-4o-mini')?.input);
  assert.equal(models[1].officialOutputPrice, 9);
});

test('normalizes aliases and resolves Grok 4.5 pricing', () => {
  assert.equal(normalizeModelLookupKey('xAI/Grok_4.5'), 'grok-4.5');
  assert.deepEqual(
    { input: getOfficialModelPrice('Grok 4.5')?.input, output: getOfficialModelPrice('grok_4.5')?.output },
    { input: 2, output: 6 },
  );
  assert.equal(getOfficialModelPrice('gpt-5.6')?.id, 'gpt-5.6-sol');
  assert.equal(getOfficialModelPrice('deepseek-chat')?.id, 'deepseek-v4-flash');
});

test('official model catalog has valid unique records and official HTTPS sources', () => {
  const ids = new Set<string>();

  for (const model of OFFICIAL_MODEL_CATALOG) {
    assert.ok(!ids.has(model.id), `duplicate model id: ${model.id}`);
    ids.add(model.id);
    assert.ok(MODEL_PROVIDERS.includes(model.provider));
    assert.ok(model.input == null || model.input >= 0);
    assert.ok(model.output == null || model.output >= 0);
    assert.equal(model.input == null, model.output == null);
    assert.ok(model.cacheRead == null || model.cacheRead >= 0);
    assert.ok(model.cacheWrite == null || model.cacheWrite >= 0);
    assert.ok(model.cnyInput == null || model.cnyInput >= 0);
    assert.ok(model.cnyOutput == null || model.cnyOutput >= 0);
    assert.equal(model.cnyInput == null, model.cnyOutput == null);
    assert.ok(model.cnyCacheRead == null || model.cnyCacheRead >= 0);
    assert.ok(model.cnyCacheWrite == null || model.cnyCacheWrite >= 0);
    assert.ok(model.input != null || model.cnyInput != null, `missing price in both currencies: ${model.id}`);
    assert.ok(model.contextWindow == null || model.contextWindow > 0);
    assert.ok(model.maxOutput == null || model.maxOutput > 0);
    assert.ok(model.officialUrl.startsWith('https://'));
    assert.match(model.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('filters model catalog by case-insensitive model name and provider', () => {
  const openAiMatches = filterOfficialModelCatalog(OFFICIAL_MODEL_CATALOG, 'GPT-5.6', 'OpenAI');
  assert.ok(openAiMatches.length > 0);
  assert.ok(openAiMatches.every((model) => model.provider === 'OpenAI' && model.id.includes('gpt-5.6')));

  const noCrossProviderMatch = filterOfficialModelCatalog(OFFICIAL_MODEL_CATALOG, 'claude', 'OpenAI');
  assert.deepEqual(noCrossProviderMatch, []);

  assert.equal(
    filterOfficialModelCatalog(OFFICIAL_MODEL_CATALOG, '', 'ALL').length,
    OFFICIAL_MODEL_CATALOG.length,
  );
});

test('catalog notes and optional fields do not change base price calculations', () => {
  const tieredModel = getOfficialModelPrice('gpt-5.5');
  const modelWithMissingCacheWrite = getOfficialModelPrice('gpt-5.4-mini');

  assert.ok(tieredModel?.note);
  assert.equal(calculateEffectivePrice(tieredModel?.input, 0.1, 2), 0.25);
  assert.equal(modelWithMissingCacheWrite?.cacheWrite, null);
});

test('converts catalog display prices to CNY without changing USD values', () => {
  assert.equal(convertCatalogPrice(5, 'USD'), 5);
  assert.equal(convertCatalogPrice(5, 'CNY'), 36);
  assert.equal(convertCatalogPrice(5, 'CNY', 31), 31);
  assert.equal(convertCatalogPrice(null, 'CNY', 13), 13);
  assert.equal(convertCatalogPrice(null, 'CNY'), null);
});
test('matches provider-prefixed catalog model names for automatic form pricing', () => {
  assert.deepEqual(
    { input: getOfficialModelPrice('alibaba/qwen3.6-flash')?.input, output: getOfficialModelPrice('moonshotai/kimi-k2.6')?.output },
    { input: 1.5, output: 4 },
  );
  assert.equal(getOfficialModelPrice('mistral/mistral-medium-2604')?.id, 'mistral-medium-3-5');
});

test('resolves verified Xiaomi and Microsoft prices for automatic form pricing', () => {
  assert.deepEqual(
    {
      input: getOfficialModelPrice('xiaomi/mimo-v2.5')?.input,
      output: getOfficialModelPrice('MiMo V2.5 Pro')?.output,
      cacheRead: getOfficialModelPrice('mimo_v2.5_pro_ultraspeed')?.cacheRead,
    },
    { input: 0.14, output: 0.87, cacheRead: 0.0108 },
  );
  assert.deepEqual(
    {
      input: getOfficialModelPrice('microsoft/mai-code-1-flash')?.input,
      output: getOfficialModelPrice('MAI Code 1 Flash')?.output,
    },
    { input: 1.1, output: 4.4 },
  );
});

test('keeps official CNY prices separate from USD fallback conversion', () => {
  const kimiHighspeed = getOfficialModelPrice('kimi-k2.7-code-highspeed');
  const xiaomi = getOfficialModelPrice('mimo-v2.5-pro');

  assert.deepEqual(
    { usdInput: kimiHighspeed?.input, cnyInput: kimiHighspeed?.cnyInput, cnyOutput: kimiHighspeed?.cnyOutput },
    { usdInput: null, cnyInput: 13, cnyOutput: 54 },
  );
  assert.deepEqual(
    { cnyInput: xiaomi?.cnyInput, cnyOutput: xiaomi?.cnyOutput, cnyCacheRead: xiaomi?.cnyCacheRead },
    { cnyInput: 3, cnyOutput: 6, cnyCacheRead: 0.025 },
  );
});

test('loads structured price tiers from the versioned catalog', () => {
  assert.match(MODEL_CATALOG_VERSION, /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
  const qwen = getOfficialModelPrice('qwen3.7-plus');
  const grok = getOfficialModelPrice('grok-4.5');

  assert.equal(getCatalogPriceTiers(qwen!, 'CNY').length, 4);
  assert.deepEqual(
    getCatalogPriceTiers(grok!, 'USD').map((tier) => [tier.input, tier.output]),
    [[2, 6], [4, 12]],
  );
  assert.deepEqual(
    getCatalogPriceTiers(grok!, 'CNY').map((tier) => [tier.input, tier.output]),
    [[14.4, 43.2], [28.8, 86.4]],
  );
});
