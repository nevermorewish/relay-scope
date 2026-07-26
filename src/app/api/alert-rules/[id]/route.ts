import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AdminInputError, parseAlertRuleUpdate, parsePositiveId } from '@/lib/admin-api-input';

interface Params {
  params: Promise<{ id: string }>;
}

/** 更新告警规则 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = parseAlertRuleUpdate(await request.json());
    const rule = await prisma.alertRule.update({
      where: { id: parsePositiveId(id, '规则 ID') },
      data: body,
    });
    return NextResponse.json(rule);
  } catch (e) {
    if (e instanceof AdminInputError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '更新失败: ' + (e as Error).message }, { status: 500 });
  }
}

/** 删除告警规则 */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.alertRule.delete({ where: { id: parsePositiveId(id, '规则 ID') } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminInputError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '删除失败: ' + (e as Error).message }, { status: 500 });
  }
}
