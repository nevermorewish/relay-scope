import assert from 'node:assert/strict';
import test from 'node:test';
import { MODEL_CATALOG_METADATA } from './model-catalog-metadata';

test('cached model metadata uses supported modalities and ISO dates', () => {
  assert.ok(Object.keys(MODEL_CATALOG_METADATA).length >= 40);
  for (const metadata of Object.values(MODEL_CATALOG_METADATA)) {
    assert.ok(metadata.input.every((item) => ['text', 'image', 'pdf', 'audio', 'video'].includes(item)));
    if (metadata.releaseDate) assert.match(metadata.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
    if (metadata.updatedAt) assert.match(metadata.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});