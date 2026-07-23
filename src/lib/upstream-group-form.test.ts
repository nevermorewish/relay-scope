import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroupRequestBody,
  createInitialGroupModels,
  validateGroupForm,
  type GroupFormValues,
} from './upstream-group-form';
import { resolveInheritedBalanceCredentials } from './key-input';

function values(overrides: Partial<GroupFormValues> = {}): GroupFormValues {
  return {
    group: ' default ',
    label: ' main ',
    userId: '',
    groupRateMultiplier: '0.5',
    apiKey: ' sk-test ',
    apiKeyDirty: false,
    accessToken: '',
    accessTokenDirty: false,
    isEditing: false,
    hasApiKey: false,
    models: [{
      clientId: 'model-1',
      modelName: ' gpt-5.6-sol ',
      officialInputPrice: '5',
      officialOutputPrice: '30',
      enabled: true,
    }],
    ...overrides,
  };
}

test('starts a new group with one enabled empty model row', () => {
  const models = createInitialGroupModels();
  assert.equal(models.length, 1);
  assert.equal(models[0].modelName, '');
  assert.equal(models[0].enabled, true);
});

test('builds a normalized create request with models, prices, and multiplier', () => {
  const input = values();
  validateGroupForm(input);
  assert.deepEqual(buildGroupRequestBody(input), {
    group: 'default',
    label: 'main',
    groupRateMultiplier: 0.5,
    monitoredModels: [{
      modelName: 'gpt-5.6-sol',
      officialInputPrice: 5,
      officialOutputPrice: 30,
      enabled: true,
    }],
    enabled: true,
    apiKey: 'sk-test',
  });
});

test('omits unchanged secrets from an edit request', () => {
  const body = buildGroupRequestBody(values({
    isEditing: true,
    hasApiKey: true,
    userId: ' user-1 ',
    apiKey: '',
    accessToken: '',
  }));
  assert.equal('apiKey' in body, false);
  assert.equal('accessToken' in body, false);
  assert.equal(body.userId, 'user-1');
  assert.equal('enabled' in body, false);
});

test('includes only secrets explicitly changed while editing', () => {
  const body = buildGroupRequestBody(values({
    isEditing: true,
    hasApiKey: true,
    apiKey: ' new-key ',
    apiKeyDirty: true,
    accessToken: ' new-token ',
    accessTokenDirty: true,
  }));
  assert.equal(body.apiKey, 'new-key');
  assert.equal(body.accessToken, 'new-token');
});

test('inherits New API balance credentials independently from existing groups', () => {
  assert.deepEqual(resolveInheritedBalanceCredentials([
    { accessTokenEnc: null, userId: 'user-2' },
    { accessTokenEnc: 'encrypted-token', userId: null },
  ]), {
    accessTokenEnc: 'encrypted-token',
    userId: 'user-2',
  });
});
