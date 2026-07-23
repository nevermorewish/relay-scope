import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { refreshKeyMetadata } from '@/lib/key-metadata-service';
import { toSafeUpstreamKey } from '@/lib/key-metadata';
import { normalizeMonitoredModels } from '@/lib/monitored-models';
import { detectUpstreamType } from '@/lib/upstream-type-detection';
import { resolveInheritedBalanceCredentials } from '@/lib/key-input';
import type { UpstreamType } from '@/lib/domain-types';

interface Params {
  params: Promise<{ id: string }>;
}

/** 列出某上游下所有 keys */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const keys = await prisma.upstreamKey.findMany({
    where: { upstreamId: Number(id) },
    orderBy: { id: 'asc' },
    include: { monitoredModels: { orderBy: { id: 'asc' } } },
  });
  // 不返回加密原文
  const safe = keys.map(toSafeUpstreamKey);
  return NextResponse.json(safe);
}

/** 新增 key */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const upstreamId = Number(id);
    if (!Number.isInteger(upstreamId)) {
      return NextResponse.json({ error: '上游 ID 无效' }, { status: 400 });
    }
    const upstream = await prisma.upstream.findUnique({
      where: { id: upstreamId },
      select: { type: true, baseUrl: true },
    });
    if (!upstream) {
      return NextResponse.json({ error: '上游不存在' }, { status: 404 });
    }

    const body = await request.json();
    const { group, label, apiKey, accessToken, userId, testModel, enabled, groupRateMultiplier } = body;
    const detectedType = await detectUpstreamType(
      upstream.baseUrl,
      { apiKey, accessToken, userId },
      upstream.type as UpstreamType,
    );
    if (detectedType !== upstream.type) {
      await prisma.upstream.update({ where: { id: upstreamId }, data: { type: detectedType } });
      upstream.type = detectedType;
    }
    const monitoredModels = normalizeMonitoredModels(body.monitoredModels);
    if (!monitoredModels.some((model) => model.enabled)) {
      return NextResponse.json({ error: '每个分组至少需要启用一个监测模型' }, { status: 400 });
    }
    const fallbackModel = monitoredModels.find((model) => model.enabled)?.modelName || testModel || null;

    if (!group) {
      return NextResponse.json({ error: '分组名不能为空' }, { status: 400 });
    }

    const existingBalanceCredentials = detectedType === 'NEW_API'
      ? await prisma.upstreamKey.findMany({
          where: {
            upstreamId,
            OR: [
              { accessTokenEnc: { not: null } },
              { userId: { not: null } },
            ],
          },
          orderBy: { id: 'asc' },
          select: { accessTokenEnc: true, userId: true },
        })
      : [];
    const inheritedBalanceCredentials = resolveInheritedBalanceCredentials(existingBalanceCredentials);

    const key = await prisma.upstreamKey.create({
      data: {
        upstreamId,
        group,
        label: label || null,
        userId: userId || inheritedBalanceCredentials.userId || null,
        testModel: fallbackModel,
        enabled: enabled !== false,
        groupRateMultiplier: groupRateMultiplier == null ? null : Number(groupRateMultiplier),
        apiKeyEnc: apiKey ? encrypt(apiKey) : undefined,
        accessTokenEnc: accessToken
          ? encrypt(accessToken)
          : inheritedBalanceCredentials.accessTokenEnc || undefined,
        monitoredModels: { create: monitoredModels },
      },
      include: { monitoredModels: { orderBy: { id: 'asc' } } },
    });

    let responseKey = key;
    let metadataRefresh = null;
    if (upstream.type === 'NEW_API') {
      try {
        const refreshed = await refreshKeyMetadata(key.id);
        responseKey = { ...key, ...refreshed.key, monitoredModels: key.monitoredModels };
        metadataRefresh = refreshed.result;
      } catch (error) {
        metadataRefresh = { ok: false, errorMessage: (error as Error).message };
      }
    }

    return NextResponse.json(
      { ...toSafeUpstreamKey(responseKey), metadataRefresh },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: '创建失败: ' + (e as Error).message }, { status: 500 });
  }
}
