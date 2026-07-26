import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  AdminInputError,
  parseAlertChannelUpdate,
  parsePositiveId,
  toSafeAlertChannel,
} from '@/lib/admin-api-input';

interface Params {
  params: Promise<{ id: string }>;
}

/** 更新告警渠道 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = parseAlertChannelUpdate(await request.json());
    const channel = await prisma.alertChannel.update({
      where: { id: parsePositiveId(id, '渠道 ID') },
      data: body,
    });
    return NextResponse.json(toSafeAlertChannel(channel));
  } catch (e) {
    if (e instanceof AdminInputError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '更新失败: ' + (e as Error).message }, { status: 500 });
  }
}

/** 删除告警渠道 */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.alertChannel.delete({ where: { id: parsePositiveId(id, '渠道 ID') } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminInputError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '删除失败: ' + (e as Error).message }, { status: 500 });
  }
}
