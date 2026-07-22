import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManagementSummary, evaluateConfiguration } from './upstream-management';

const key = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  hasApiKey: true,
  hasAccessToken: false,
  userId: null,
  testModel: 'gpt-test',
  ...overrides,
});

test('marks a complete SUB2API configuration as ready', () => {
  assert.equal(evaluateConfiguration({ type: 'SUB2API', enabled: true, testModel: 'gpt-test', keys: [key()] }).state, 'READY');
});

test('detects missing credentials, model, and enabled groups', () => {
  assert.equal(evaluateConfiguration({ type: 'SUB2API', enabled: true, keys: [key({ hasApiKey: false })] }).state, 'NEEDS_CONFIG');
  assert.equal(evaluateConfiguration({ type: 'SUB2API', enabled: true, keys: [key({ testModel: null })] }).state, 'NEEDS_CONFIG');
  assert.equal(evaluateConfiguration({ type: 'SUB2API', enabled: true, keys: [] }).state, 'NEEDS_CONFIG');
});

test('requires all New API credentials', () => {
  const incomplete = key({ hasAccessToken: true, userId: null });
  const complete = key({ hasAccessToken: true, userId: 'user-1' });
  assert.equal(evaluateConfiguration({ type: 'NEW_API', enabled: true, keys: [incomplete] }).state, 'NEEDS_CONFIG');
  assert.equal(evaluateConfiguration({ type: 'NEW_API', enabled: true, keys: [complete] }).state, 'READY');
});

test('keeps configuration readiness separate from pause and detection errors', () => {
  assert.equal(evaluateConfiguration({ type: 'SUB2API', enabled: false, keys: [key()] }).state, 'READY');
  const health = evaluateConfiguration({ type: 'SUB2API', enabled: true, keys: [key({ lastError: 'timeout' })] });
  assert.equal(health.state, 'READY');
  assert.equal(health.errorMessage, 'timeout');
});

test('reports distinct models and the latest collection time', () => {
  const health = evaluateConfiguration({
    type: 'SUB2API',
    enabled: true,
    keys: [
      key({ testModel: 'model-a', lastCollectedAt: '2026-07-20T10:00:00.000Z' }),
      key({ testModel: 'model-b', lastCollectedAt: '2026-07-20T11:00:00.000Z' }),
      key({ testModel: 'model-a', lastCollectedAt: '2026-07-20T09:00:00.000Z' }),
    ],
  });
  assert.deepEqual(health.modelNames, ['model-a', 'model-b']);
  assert.equal(health.latestCollectedAt, '2026-07-20T11:00:00.000Z');
});

test('builds all-site summary independent of row pagination', () => {
  const summary = buildManagementSummary([
    { type: 'SUB2API', enabled: true, keys: [key()] },
    { type: 'SUB2API', enabled: false, keys: [key()] },
    { type: 'SUB2API', enabled: true, keys: [key({ hasApiKey: false })] },
  ]);
  assert.deepEqual(summary, { total: 3, enabled: 2, credentialsReady: 1, pending: 1, latestCollectedAt: null });
});
