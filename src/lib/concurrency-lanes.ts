export async function runInConcurrencyLanes<T, R>(
  items: readonly T[],
  getLaneKey: (item: T) => string,
  worker: (item: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const lanes = new Map<string, Array<{ item: T; index: number }>>();
  items.forEach((item, index) => {
    const laneKey = getLaneKey(item);
    const lane = lanes.get(laneKey) || [];
    lane.push({ item, index });
    lanes.set(laneKey, lane);
  });

  const results = new Array<PromiseSettledResult<R>>(items.length);
  await Promise.all(Array.from(lanes.values()).map(async (lane) => {
    for (const entry of lane) {
      try {
        results[entry.index] = { status: 'fulfilled', value: await worker(entry.item) };
      } catch (reason) {
        results[entry.index] = { status: 'rejected', reason };
      }
    }
  }));
  return results;
}
