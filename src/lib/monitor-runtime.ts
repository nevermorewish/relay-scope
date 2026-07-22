interface MonitorRuntimeState {
  running: boolean;
  nextRunAt: string | null;
  source: 'automatic' | 'manual' | null;
}

export class MonitorBusyError extends Error {
  constructor() {
    super('已有检测正在进行，请稍后再试');
  }
}

export function getMonitorRuntimeState(): MonitorRuntimeState {
  const root = globalThis as typeof globalThis & { relayMonitorRuntime?: MonitorRuntimeState };
  if (!root.relayMonitorRuntime) {
    root.relayMonitorRuntime = { running: false, nextRunAt: null, source: null };
  }
  return root.relayMonitorRuntime;
}

export async function withMonitorLock<T>(
  source: MonitorRuntimeState['source'],
  task: () => Promise<T>
) {
  const state = getMonitorRuntimeState();
  if (state.running) throw new MonitorBusyError();
  state.running = true;
  state.source = source;
  try {
    return await task();
  } finally {
    state.running = false;
    state.source = null;
  }
}

export function setNextMonitorRun(date: Date | null) {
  getMonitorRuntimeState().nextRunAt = date?.toISOString() ?? null;
}
