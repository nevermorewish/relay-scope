import test from 'node:test';
import assert from 'node:assert/strict';
import { combineCollectionAndModelStatus } from './model-health';

test('keeps a model failure degraded after a successful light collection', () => {
  assert.equal(combineCollectionAndModelStatus('ONLINE', [false]), 'DEGRADED');
});

test('clears model degradation only after the latest model result succeeds', () => {
  assert.equal(combineCollectionAndModelStatus('ONLINE', [true]), 'ONLINE');
});

test('keeps an unreachable channel offline even when its latest model test failed', () => {
  assert.equal(combineCollectionAndModelStatus('OFFLINE', [false]), 'OFFLINE');
});

test('does not change degradation caused by the current collection', () => {
  assert.equal(combineCollectionAndModelStatus('DEGRADED', [true]), 'DEGRADED');
});
