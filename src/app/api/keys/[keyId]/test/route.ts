import { NextResponse } from 'next/server';
import { collectOneKeyManual } from '@/lib/collector';
import { MonitorBusyError, withMonitorLock } from '@/lib/monitor-runtime';

interface Params {
  params: Promise<{ keyId: string }>;
}

/** 手动触发单个 key 的完整采集 */
export async function POST(request: Request, { params }: Params) {
  const { keyId } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const rawModelId = (body as { monitoredModelId?: unknown }).monitoredModelId;
    const monitoredModelId = rawModelId == null ? undefined : Number(rawModelId);
    if (monitoredModelId != null && !Number.isInteger(monitoredModelId)) {
      return NextResponse.json({ error: '模型 ID 无效' }, { status: 400 });
    }
    const metric = await withMonitorLock(
      'manual',
      () => collectOneKeyManual(Number(keyId), monitoredModelId)
    );
    if (!metric) {
      return NextResponse.json({ error: '采集失败：未配置凭证' }, { status: 400 });
    }
    return NextResponse.json(metric);
  } catch (e) {
    if (e instanceof MonitorBusyError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: '测试失败: ' + (e as Error).message }, { status: 500 });
  }
}
