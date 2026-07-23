import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLatencySeconds,
  latencyThresholdForDisplay,
  latencyThresholdForStorage,
  normalizeLatencyMessage,
} from './latency-display';

test('formats stored millisecond latency consistently as seconds', () => {
  assert.equal(formatLatencySeconds(190), '0.19秒');
  assert.equal(formatLatencySeconds(11097), '11.10秒');
  assert.equal(formatLatencySeconds(null), '—');
});

test('converts latency thresholds without changing storage units', () => {
  assert.equal(latencyThresholdForDisplay(3000), 3);
  assert.equal(latencyThresholdForStorage(3.5), 3500);
});

test('normalizes historical latency alert messages', () => {
  assert.equal(
    normalizeLatencyMessage('延迟 1240ms 高于阈值 1000ms'),
    '延迟 1.24秒 高于阈值 1.00秒',
  );
});
