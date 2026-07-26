import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface Params {
  params: Promise<{ id: string }>;
}

/** 获取单个上游（含 keys） */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const upstream = await prisma.upstream.findUnique({
    where: { id: Number(id) },
    include: { keys: { orderBy: { id: 'asc' }, include: { monitoredModels: { orderBy: { id: 'asc' } } } } },
  });
  if (!upstream) {
    return NextResponse.json({ error: '上游不存在' }, { status: 404 });
  }
  const heavyMetrics = await prisma.metric.findMany({
    where: {
      upstreamId: upstream.id,
      probeMode: 'HEAVY',
      modelTestOk: { not: null },
    },
    orderBy: { recordedAt: 'desc' },
    select: {
      upstreamKeyId: true,
      testModel: true,
      modelTestOk: true,
      modelTestLatMs: true,
      errorMessage: true,
      recordedAt: true,
    },
  });
  const latestByKey = new Map<number, typeof heavyMetrics[number]>();
  const latestByModel = new Map<string, typeof heavyMetrics[number]>();
  for (const metric of heavyMetrics) {
    if (metric.upstreamKeyId == null) continue;
    if (!latestByKey.has(metric.upstreamKeyId)) latestByKey.set(metric.upstreamKeyId, metric);
    const modelKey = `${metric.upstreamKeyId}\0${metric.testModel}`;
    if (!latestByModel.has(modelKey)) latestByModel.set(modelKey, metric);
  }
  // 处理 keys 的凭证标志
  const keys = upstream.keys.map(({ apiKeyEnc, accessTokenEnc, ...rest }) => {
    const latest = latestByKey.get(rest.id);
    return {
    ...rest,
    monitoredModels: rest.monitoredModels.map((model) => {
      const modelLatest = latestByModel.get(`${rest.id}\0${model.modelName}`);
      return {
        ...model,
        latestTest: modelLatest ? {
          ok: modelLatest.modelTestOk,
          errorMessage: modelLatest.errorMessage,
          recordedAt: modelLatest.recordedAt,
        } : null,
      };
    }),
    hasApiKey: !!apiKeyEnc,
    hasAccessToken: !!accessTokenEnc,
    latestModelTestLatencyMs: latest?.modelTestLatMs ?? null,
    latestModelTestAt: latest?.recordedAt ?? null,
    latestModelTestModel: latest?.testModel ?? null,
  };
  });
  return NextResponse.json({ ...upstream, keys });
}

/** 更新上游元信息 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { name, baseUrl, type, enabled, priority, creditUsdPerCny } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (baseUrl !== undefined) data.baseUrl = String(baseUrl).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (type !== undefined) data.type = type;
    if (enabled !== undefined) data.enabled = enabled;
    if (priority !== undefined) data.priority = priority;
    if (creditUsdPerCny !== undefined) {
      const rate = Number(creditUsdPerCny);
      if (!Number.isFinite(rate) || rate <= 0) {
        return NextResponse.json({ error: '每元人民币获得的美元额度必须大于 0' }, { status: 400 });
      }
      data.creditUsdPerCny = rate;
    }

    const upstream = await prisma.upstream.update({ where: { id: Number(id) }, data });
    return NextResponse.json(upstream);
  } catch (e) {
    return NextResponse.json({ error: '更新失败: ' + (e as Error).message }, { status: 500 });
  }
}

/** 删除上游（级联删除 keys/metrics/incidents） */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.upstream.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '删除失败: ' + (e as Error).message }, { status: 500 });
  }
}
