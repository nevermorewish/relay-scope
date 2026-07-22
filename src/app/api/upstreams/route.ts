import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { UpstreamType } from '@/lib/domain-types';
import { detectUpstreamType } from '@/lib/upstream-type-detection';
import { parsePaginationParams } from '@/lib/pagination';
import { toSafeUpstreamKey } from '@/lib/key-metadata';
import { buildManagementSummary } from '@/lib/upstream-management';
import {
  buildUpstreamOrderBy,
  buildUpstreamWhere,
  calculateSharedBalance,
  convertUsdCreditToCny,
  parseUpstreamQueryParams,
  sortAndPaginateByBalance,
} from '@/lib/upstream-query';

/** 分页获取上游（含 keys 列表） */
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const { page, pageSize } = parsePaginationParams(searchParams);
  const query = parseUpstreamQueryParams(searchParams);
  const where = buildUpstreamWhere(query);
  const summaryRows = await prisma.upstream.findMany({
    select: {
      type: true,
      enabled: true,
      keys: {
        select: {
          enabled: true,
          apiKeyEnc: true,
          accessTokenEnc: true,
          userId: true,
          testModel: true,
          lastCollectedAt: true,
          lastError: true,
          metadataError: true,
          monitoredModels: { select: { modelName: true, enabled: true } },
        },
      },
    },
  });
  const summary = buildManagementSummary(summaryRows.map((upstream) => ({
    type: upstream.type,
    enabled: upstream.enabled,
    keys: upstream.keys.map((key) => ({
      enabled: key.enabled,
      hasApiKey: Boolean(key.apiKeyEnc),
      hasAccessToken: Boolean(key.accessTokenEnc),
      userId: key.userId,
      testModel: key.testModel,
      lastCollectedAt: key.lastCollectedAt,
      lastError: key.lastError,
      metadataError: key.metadataError,
      monitoredModels: key.monitoredModels,
    })),
  })));

  if (query.sort === 'totalBalance') {
    const upstreams = await prisma.upstream.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        keys: {
          orderBy: { id: 'asc' },
          include: { monitoredModels: { orderBy: { id: 'asc' } } },
        },
      },
    });
    const result = sortAndPaginateByBalance(upstreams, query.direction, page, pageSize);

    const items = await addLatestModelTests(result.items.map((upstream) => ({
        ...upstream,
        keys: upstream.keys.map(toSafeUpstreamKey),
      })));
    return NextResponse.json({
      items,
      summary,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  const total = await prisma.upstream.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const upstreams = await prisma.upstream.findMany({
    where,
    orderBy: buildUpstreamOrderBy(query),
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    include: {
      keys: {
        orderBy: { id: 'asc' },
        include: { monitoredModels: { orderBy: { id: 'asc' } } },
      },
    },
  });

  // 去掉加密原文，计算 hasApiKey/hasAccessToken 标志
  const result = await addLatestModelTests(upstreams.map((u) => ({
    ...u,
    totalBalance: convertUsdCreditToCny(calculateSharedBalance(u.keys), u.creditUsdPerCny),
    keys: u.keys.map(toSafeUpstreamKey),
  })));

  return NextResponse.json({
    items: result,
    summary,
    pagination: {
      page: currentPage,
      pageSize,
      total,
      totalPages,
    },
  });
}

/** 新建上游（不含凭证，凭证通过 keys 端点添加） */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, baseUrl, enabled, priority, creditUsdPerCny } = body;

    if (!name || !baseUrl) {
      return NextResponse.json({ error: '名称和地址不能为空' }, { status: 400 });
    }

    const type = await detectUpstreamType(baseUrl);
    const upstream = await prisma.upstream.create({
      data: {
        name,
        baseUrl: normalizeUrl(baseUrl),
        type: type as UpstreamType,
        testModel: null,
        enabled: enabled !== false,
        priority: priority ?? 0,
        creditUsdPerCny: validCreditRate(creditUsdPerCny),
      },
    });
    return NextResponse.json(upstream, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: '创建失败: ' + (e as Error).message }, { status: 500 });
  }
}

async function addLatestModelTests<
  T extends { keys: Array<{ id: number; monitoredModels: Array<{ modelName: string }> }> }
>(upstreams: T[]) {
  const keyIds = upstreams.flatMap((upstream) => upstream.keys.map((key) => key.id));
  if (keyIds.length === 0) return upstreams;

  const targets = upstreams.flatMap((upstream) => upstream.keys.flatMap((key) => (
    key.monitoredModels.map((model) => ({ upstreamKeyId: key.id, modelName: model.modelName }))
  )));
  const metrics = (await Promise.all(targets.map((target) => prisma.metric.findFirst({
    where: {
      upstreamKeyId: target.upstreamKeyId,
      probeMode: 'HEAVY',
      testModel: target.modelName,
    },
    orderBy: { recordedAt: 'desc' },
    select: {
      upstreamKeyId: true,
      testModel: true,
      modelTestOk: true,
      errorMessage: true,
      recordedAt: true,
    },
  })))).filter((metric) => metric != null);
  const latestByModel = new Map<string, typeof metrics[number]>();
  for (const metric of metrics) {
    const mapKey = `${metric.upstreamKeyId}\0${metric.testModel}`;
    if (!latestByModel.has(mapKey)) latestByModel.set(mapKey, metric);
  }

  return upstreams.map((upstream) => ({
    ...upstream,
    keys: upstream.keys.map((key) => ({
      ...key,
      monitoredModels: key.monitoredModels.map((model) => {
        const latest = latestByModel.get(`${key.id}\0${model.modelName}`);
        return {
          ...model,
          latestTest: latest ? {
            ok: latest.modelTestOk,
            errorMessage: latest.errorMessage,
            recordedAt: latest.recordedAt,
          } : null,
        };
      }),
    })),
  }));
}

function validCreditRate(value: unknown) {
  const rate = Number(value ?? 1);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}
