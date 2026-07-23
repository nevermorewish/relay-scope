import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { collectUpstreamsByCredential } from '@/lib/collector';
import { withMonitorRun } from '@/lib/monitor-runtime';

export async function POST() {
  try {
    const upstreams = await prisma.upstream.findMany({
      where: { enabled: true },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
      include: { keys: { where: { enabled: true } } },
    });

    const results = await withMonitorRun('manual', async () => {
      const collection = await collectUpstreamsByCredential(upstreams, 'heavy');
      return upstreams.filter((upstream) => upstream.keys.length > 0).map((upstream) => {
        const siteResults = collection.filter((item) => item.upstreamId === upstream.id);
        const successful = siteResults.filter(
          (item) => item.result.status === 'fulfilled' && item.result.value?.success === true
        ).length;
        return {
          upstreamId: upstream.id,
          name: upstream.name,
          successful,
          total: siteResults.length,
        };
      });
    });

    return NextResponse.json({
      ok: results.some((result) => result.successful > 0),
      sites: results,
      successful: results.reduce((sum, result) => sum + result.successful, 0),
      total: results.reduce((sum, result) => sum + result.total, 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: '全部测试失败: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
