import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AdminInputError, parseAlertRuleCreate } from '@/lib/admin-api-input';

export const dynamic = 'force-dynamic';

/** 获取所有告警规则 */
export async function GET() {
  const rules = await prisma.alertRule.findMany({ orderBy: { id: 'asc' } });
  return NextResponse.json(rules);
}

/** 新建告警规则 */
export async function POST(request: Request) {
  try {
    const body = parseAlertRuleCreate(await request.json());
    const rule = await prisma.alertRule.create({ data: body });
    return NextResponse.json(rule, { status: 201 });
  } catch (e) {
    if (e instanceof AdminInputError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '创建失败: ' + (e as Error).message }, { status: 500 });
  }
}
