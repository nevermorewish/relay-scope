import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNextHeavyRunAt } from './monitor-schedule';

test('returns the next scheduler tick that falls on a heavy-test minute', () => {
  const next = calculateNextHeavyRunAt('2026-07-22T12:51:13.000Z', 15);
  assert.equal(next?.toISOString(), '2026-07-22T13:00:13.000Z');
});

test('keeps an immediate tick when it is already a heavy-test minute', () => {
  const next = calculateNextHeavyRunAt('2026-07-22T13:00:13.000Z', 15);
  assert.equal(next?.toISOString(), '2026-07-22T13:00:13.000Z');
});
