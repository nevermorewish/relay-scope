import { runCollectCycle } from './collector';
import { getAutoMonitorEnabled } from './settings';
import { AutomaticMonitorAlreadyRunningError, setNextMonitorRun, withMonitorRun } from './monitor-runtime';

const INTERVAL_MS = 60_000;

export async function triggerScheduledCollection() {
  if (!await getAutoMonitorEnabled()) {
    setNextMonitorRun(null);
    return;
  }

  try {
    const result = await withMonitorRun('automatic', runCollectCycle);
    console.log(`[monitor] ${new Date().toISOString()} collected=${result.collected} mode=${result.mode}`);
  } catch (error) {
    if (!(error instanceof AutomaticMonitorAlreadyRunningError)) {
      console.error('[monitor] collection failed:', error instanceof Error ? error.message : error);
    }
  } finally {
    if (await getAutoMonitorEnabled()) setNextMonitorRun(new Date(Date.now() + INTERVAL_MS));
  }
}

export function startMonitorScheduler() {
  const state = globalThis as typeof globalThis & {
    relayMonitorScheduler?: ReturnType<typeof setInterval>;
  };
  if (state.relayMonitorScheduler) return;

  setNextMonitorRun(new Date(Date.now() + 5_000));
  setTimeout(() => void triggerScheduledCollection(), 5_000);
  state.relayMonitorScheduler = setInterval(() => void triggerScheduledCollection(), INTERVAL_MS);
}
