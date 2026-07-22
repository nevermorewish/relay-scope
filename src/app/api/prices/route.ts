import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshots = await prisma.priceSnapshot.findMany({
    orderBy: { recordedAt: 'desc' },
    take: 10000,
    include: {
      upstream: { select: { name: true, type: true } },
      upstreamKey: { select: { group: true, groupName: true, label: true } },
    },
  });
  const seen = new Set<string>();
  const latest = snapshots.filter((snapshot) => {
    const key = `${snapshot.upstreamId}:${snapshot.upstreamKeyId ?? 0}:${snapshot.modelName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return NextResponse.json(latest);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const upstreamId = Number(body.upstreamId);
    const upstreamKeyId = body.upstreamKeyId ? Number(body.upstreamKeyId) : null;
    const modelName = String(body.modelName || '').trim();
    if (!upstreamId || !modelName) {
      return NextResponse.json({ error: '站点和模型不能为空' }, { status: 400 });
    }
    const priceFields = ['inputPrice', 'outputPrice', 'cacheReadPrice', 'cacheWritePrice', 'fixedPrice'] as const;
    for (const field of priceFields) {
      if (body[field] === '' || body[field] == null) continue;
      const value = Number(body[field]);
      if (!Number.isFinite(value) || value < 0) {
        return NextResponse.json({ error: '价格必须是大于或等于 0 的数字' }, { status: 400 });
      }
    }
    if (upstreamKeyId) {
      const key = await prisma.upstreamKey.findFirst({ where: { id: upstreamKeyId, upstreamId } });
      if (!key) return NextResponse.json({ error: '分组不属于所选站点' }, { status: 400 });
    }
    const optionalNumber = (value: unknown) => value === '' || value == null ? null : Number(value);
    const data = await prisma.priceSnapshot.create({
      data: {
        upstreamId,
        upstreamKeyId,
        modelName,
        currency: String(body.currency || 'CNY').toUpperCase(),
        inputPrice: optionalNumber(body.inputPrice),
        outputPrice: optionalNumber(body.outputPrice),
        cacheReadPrice: optionalNumber(body.cacheReadPrice),
        cacheWritePrice: optionalNumber(body.cacheWritePrice),
        fixedPrice: optionalNumber(body.fixedPrice),
        source: 'MANUAL',
      },
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: `保存价格失败: ${(error as Error).message}` }, { status: 500 });
  }
}
