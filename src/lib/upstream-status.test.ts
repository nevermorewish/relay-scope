import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateUpstreamStatus } from './upstream-status';

test('keeps a site online while any enabled group is online', () => {
  assert.equal(aggregateUpstreamStatus(['ONLINE', 'OFFLINE']), 'ONLINE');
  assert.equal(aggregateUpstreamStatus(['DEGRADED', 'ONLINE']), 'ONLINE');
});

test('uses the strongest remaining failure when no group is online', () => {
  assert.equal(aggregateUpstreamStatus(['DEGRADED', 'OFFLINE']), 'DEGRADED');
  assert.equal(aggregateUpstreamStatus(['OFFLINE', 'UNKNOWN']), 'OFFLINE');
  assert.equal(aggregateUpstreamStatus(['UNKNOWN']), 'UNKNOWN');
  assert.equal(aggregateUpstreamStatus([]), 'UNKNOWN');
});
