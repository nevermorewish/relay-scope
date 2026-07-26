import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  AdminInputError,
  parseAlertChannelCreate,
  toSafeAlertChannel,
} from '@/lib/admin-api-input';

export const dynamic = 'force-dynamic';

/** 获取所有告警渠道 */
export async function GET() {
  const channels = await prisma.alertChannel.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(channels.map((channel) => toSafeAlertChannel(channel)));
}

/** 新建告警渠道 */
export async function POST(request: Request) {
  try {
    const body = parseAlertChannelCreate(await request.json());
    const channel = await prisma.alertChannel.create({ data: body });
    return NextResponse.json(toSafeAlertChannel(channel), { status: 201 });
  } catch (e) {
    if (e instanceof AdminInputError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '创建失败: ' + (e as Error).message }, { status: 500 });
  }
}
