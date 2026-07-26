import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNextHeavyRunAt, scheduledCollectMode } from './monitor-schedule';

test('returns the next scheduler tick that falls on a heavy-test minute', () => {
  const next = calculateNextHeavyRunAt('2026-07-22T12:51:13.000Z', 15);
  assert.equal(next?.toISOString(), '2026-07-22T13:00:13.000Z');
});

test('keeps an immediate tick when it is already a heavy-test minute', () => {
  const next = calculateNextHeavyRunAt('2026-07-22T13:00:13.000Z', 15);
  assert.equal(next?.toISOString(), '2026-07-22T13:00:13.000Z');
});

test('classifies scheduler ticks as light or heavy consistently', () => {
  assert.equal(scheduledCollectMode(new Date('2026-07-22T13:00:13.000Z'), 15), 'heavy');
  assert.equal(scheduledCollectMode(new Date('2026-07-22T13:01:13.000Z'), 15), 'light');
});
