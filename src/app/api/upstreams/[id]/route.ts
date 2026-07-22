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
  // 处理 keys 的凭证标志
  const keys = upstream.keys.map(({ apiKeyEnc, accessTokenEnc, ...rest }) => ({
    ...rest,
    hasApiKey: !!apiKeyEnc,
    hasAccessToken: !!accessTokenEnc,
  }));
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
