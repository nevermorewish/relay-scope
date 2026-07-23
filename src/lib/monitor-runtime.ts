interface MonitorRuntimeState {
  running: boolean;
  nextRunAt: string | null;
  source: 'automatic' | 'manual' | null;
}

interface MonitorRuntimeInternal {
  state: MonitorRuntimeState;
  activeAutomatic: number;
  activeManual: number;
  credentialLanes: Map<string, Promise<void>>;
}

export class AutomaticMonitorAlreadyRunningError extends Error {
  constructor() {
    super('自动监测上一轮尚未结束');
  }
}

function getMonitorRuntimeInternal(): MonitorRuntimeInternal {
  const root = globalThis as typeof globalThis & { relayMonitorRuntimeInternal?: MonitorRuntimeInternal };
  if (!root.relayMonitorRuntimeInternal) {
    root.relayMonitorRuntimeInternal = {
      state: { running: false, nextRunAt: null, source: null },
      activeAutomatic: 0,
      activeManual: 0,
      credentialLanes: new Map(),
    };
  }
  return root.relayMonitorRuntimeInternal;
}

export function getMonitorRuntimeState(): MonitorRuntimeState {
  return getMonitorRuntimeInternal().state;
}

export async function withMonitorRun<T>(
  source: Exclude<MonitorRuntimeState['source'], null>,
  task: () => Promise<T>,
) {
  const runtime = getMonitorRuntimeInternal();
  if (source === 'automatic' && runtime.activeAutomatic > 0) {
    throw new AutomaticMonitorAlreadyRunningError();
  }
  if (source === 'automatic') runtime.activeAutomatic += 1;
  else runtime.activeManual += 1;
  syncRuntimeState(runtime);
  try {
    return await task();
  } finally {
    if (source === 'automatic') runtime.activeAutomatic = Math.max(0, runtime.activeAutomatic - 1);
    else runtime.activeManual = Math.max(0, runtime.activeManual - 1);
    syncRuntimeState(runtime);
  }
}

export async function withCredentialLane<T>(laneKey: string, task: () => Promise<T>): Promise<T> {
  const lanes = getMonitorRuntimeInternal().credentialLanes;
  const previous = lanes.get(laneKey) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.catch(() => undefined).then(() => gate);
  lanes.set(laneKey, tail);

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (lanes.get(laneKey) === tail) lanes.delete(laneKey);
  }
}

export function setNextMonitorRun(date: Date | null) {
  getMonitorRuntimeInternal().state.nextRunAt = date?.toISOString() ?? null;
}

function syncRuntimeState(runtime: MonitorRuntimeInternal) {
  runtime.state.running = runtime.activeAutomatic + runtime.activeManual > 0;
  runtime.state.source = runtime.activeManual > 0
    ? 'manual'
    : runtime.activeAutomatic > 0
      ? 'automatic'
      : null;
}
