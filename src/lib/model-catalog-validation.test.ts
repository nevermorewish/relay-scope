import assert from 'node:assert/strict';
import test from 'node:test';
import catalog from '../../data/model-catalog.json';
import type { ModelCatalogDocument } from './model-catalog-schema';
import { validateModelCatalog } from './model-catalog-validation';

test('versioned model catalog passes the standalone schema validation', () => {
  assert.deepEqual(validateModelCatalog(catalog), []);
  assert.equal(catalog.schemaVersion, 1);
  assert.match(catalog.catalogVersion, /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
});

test('model catalog validation rejects unsafe price and reference changes', () => {
  const invalidCatalog = structuredClone(catalog) as unknown as ModelCatalogDocument;
  invalidCatalog.prices[0].usd.input = -1;
  invalidCatalog.prices.push(structuredClone(invalidCatalog.prices[0]));
  invalidCatalog.aliases['broken-alias'] = 'missing-model';

  const errors = validateModelCatalog(invalidCatalog);
  assert.ok(errors.some((error) => error.includes('must be null or non-negative')));
  assert.ok(errors.some((error) => error.includes('duplicate price id')));
  assert.ok(errors.some((error) => error.includes('alias target does not exist')));
});
