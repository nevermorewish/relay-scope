import assert from 'node:assert/strict';
import test from 'node:test';
import { runInConcurrencyLanes } from './concurrency-lanes';

test('runs matching credentials serially while different credentials overlap', async () => {
  const activeByLane = new Map<string, number>();
  let activeTotal = 0;
  let maxActiveTotal = 0;
  let maxActiveInLane = 0;
  const items = [
    { id: 'a1', lane: 'same-key' },
    { id: 'a2', lane: 'same-key' },
    { id: 'b1', lane: 'other-key' },
  ];

  const results = await runInConcurrencyLanes(items, (item) => item.lane, async (item) => {
    const laneActive = (activeByLane.get(item.lane) || 0) + 1;
    activeByLane.set(item.lane, laneActive);
    activeTotal += 1;
    maxActiveInLane = Math.max(maxActiveInLane, laneActive);
    maxActiveTotal = Math.max(maxActiveTotal, activeTotal);
    await new Promise((resolve) => setTimeout(resolve, 10));
    activeByLane.set(item.lane, laneActive - 1);
    activeTotal -= 1;
    return item.id;
  });

  assert.equal(maxActiveInLane, 1);
  assert.ok(maxActiveTotal >= 2);
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'fulfilled', 'fulfilled']);
});

test('continues a credential lane after one task fails', async () => {
  const visited: string[] = [];
  const results = await runInConcurrencyLanes(
    ['first', 'second'],
    () => 'same-key',
    async (item) => {
      visited.push(item);
      if (item === 'first') throw new Error('failed');
      return item;
    },
  );

  assert.deepEqual(visited, ['first', 'second']);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'fulfilled');
});
