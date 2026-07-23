import test from 'node:test';
import assert from 'node:assert/strict';
import { findNewEnabledModels } from './new-model-testing';

test('selects only newly added enabled models for an immediate test', () => {
  assert.deepEqual(findNewEnabledModels(
    [{ modelName: 'model-a' }],
    [
      { id: 1, modelName: 'MODEL-A', enabled: true },
      { id: 2, modelName: 'model-b', enabled: true },
      { id: 3, modelName: 'model-c', enabled: false },
    ],
  ).map((model) => model.id), [2]);
});
