import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAutoResolveIncident,
  requiresIncidentAcknowledgement,
  resolveIncidentActionLabel,
  resolvedIncidentLabel,
  resolvedIncidentTimeLabel,
} from './incident-semantics';

test('treats price changes as acknowledgement events instead of recoverable failures', () => {
  assert.equal(requiresIncidentAcknowledgement('PRICE_CHANGED'), true);
  assert.equal(canAutoResolveIncident('PRICE_CHANGED'), false);
  assert.equal(resolvedIncidentLabel('PRICE_CHANGED'), '已确认');
  assert.equal(resolvedIncidentTimeLabel('PRICE_CHANGED'), '确认于');
  assert.equal(resolveIncidentActionLabel('PRICE_CHANGED'), '确认已知');
});

test('keeps operational incidents recoverable', () => {
  assert.equal(requiresIncidentAcknowledgement('UNAVAILABLE'), false);
  assert.equal(canAutoResolveIncident('UNAVAILABLE'), true);
  assert.equal(resolvedIncidentLabel('UNAVAILABLE'), '已恢复');
  assert.equal(resolvedIncidentTimeLabel('UNAVAILABLE'), '恢复于');
});
