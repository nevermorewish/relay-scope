import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AutomaticMonitorAlreadyRunningError,
  getMonitorRuntimeState,
  withCredentialLane,
  withMonitorRun,
} from './monitor-runtime';

test('serializes the same credential lane while allowing different lanes to overlap', async () => {
  const events: string[] = [];
  let releaseFirst: () => void = () => undefined;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

  const first = withCredentialLane('runtime-test-same', async () => {
    events.push('first-start');
    await firstGate;
    events.push('first-end');
  });
  const second = withCredentialLane('runtime-test-same', async () => {
    events.push('second-start');
  });
  const other = withCredentialLane('runtime-test-other', async () => {
    events.push('other-start');
  });

  await other;
  assert.deepEqual(events, ['first-start', 'other-start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first-start', 'other-start', 'first-end', 'second-start']);
});

test('tracks overlapping automatic and manual monitor runs without rejecting either', async () => {
  let releaseAutomatic: () => void = () => undefined;
  const automaticGate = new Promise<void>((resolve) => { releaseAutomatic = resolve; });
  const automatic = withMonitorRun('automatic', () => automaticGate);
  await Promise.resolve();
  assert.equal(getMonitorRuntimeState().source, 'automatic');
  await assert.rejects(
    withMonitorRun('automatic', async () => undefined),
    AutomaticMonitorAlreadyRunningError,
  );

  const manual = withMonitorRun('manual', async () => {
    assert.equal(getMonitorRuntimeState().source, 'manual');
  });
  await manual;
  assert.equal(getMonitorRuntimeState().source, 'automatic');
  releaseAutomatic();
  await automatic;
  assert.equal(getMonitorRuntimeState().running, false);
});

test('only exposes the automatic testing state for heavy runs', async () => {
  await withMonitorRun('automatic', async () => {
    assert.equal(getMonitorRuntimeState().running, true);
    assert.equal(getMonitorRuntimeState().automaticHeavyRunning, false);
  }, 'light');

  await withMonitorRun('automatic', async () => {
    assert.equal(getMonitorRuntimeState().running, true);
    assert.equal(getMonitorRuntimeState().automaticHeavyRunning, true);
  }, 'heavy');

  assert.equal(getMonitorRuntimeState().automaticHeavyRunning, false);
});
