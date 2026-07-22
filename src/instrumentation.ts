export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMonitorScheduler } = await import('./lib/monitor-scheduler');
    startMonitorScheduler();
  }
}
