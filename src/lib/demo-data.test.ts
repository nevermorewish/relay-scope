import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoDataset } from './demo-data';

test('demo dashboard presents healthy availability with dense recent probes', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');
  const dataset = buildDemoDataset(now);
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recent = dataset.metrics.filter((metric) => metric.recordedAt > cutoff);
  const light = recent.filter((metric) => metric.probeMode === 'LIGHT');
  const availability = light.filter((metric) => metric.success).length / light.length * 100;

  assert.ok(availability >= 97);

  for (const key of dataset.keys.filter((item) => item.status !== 'UNKNOWN')) {
    const heavy = recent.filter(
      (metric) => metric.keySlug === key.slug && metric.probeMode === 'HEAVY'
    );
    assert.equal(heavy.length, 12);
  }
});
