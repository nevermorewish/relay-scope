import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateEffectivePrice, getOfficialModelPrice, normalizeModelLookupKey } from './official-model-prices';
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
});
