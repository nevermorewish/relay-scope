import { NextResponse } from 'next/server';
import { getMonitorRuntimeState, setNextMonitorRun } from '@/lib/monitor-runtime';
import { getAutoMonitorEnabled, setSetting, SettingKeys } from '@/lib/settings';
import { triggerScheduledCollection } from '@/lib/monitor-scheduler';
import { getCollectConfig } from '@/lib/settings';
import { calculateNextHeavyRunAt } from '@/lib/monitor-schedule';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await buildMonitorStatus(await getAutoMonitorEnabled()));
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: '开关状态无效' }, { status: 400 });
  }

  await setSetting(SettingKeys.AUTO_MONITOR_ENABLED, String(body.enabled));
  if (body.enabled) {
    setNextMonitorRun(new Date());
    void triggerScheduledCollection();
  } else {
    setNextMonitorRun(null);
  }

  return NextResponse.json(await buildMonitorStatus(body.enabled));
}

async function buildMonitorStatus(enabled: boolean) {
  const runtime = getMonitorRuntimeState();
  const config = await getCollectConfig();
  return {
    enabled,
    ...runtime,
    nextHeavyRunAt: enabled
      ? calculateNextHeavyRunAt(runtime.nextRunAt, config.heavyMin)?.toISOString() ?? null
      : null,
  };
}
