import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { buildKeyUpdateData } from '@/lib/key-input';
import { refreshKeyMetadata } from '@/lib/key-metadata-service';
import { toSafeUpstreamKey } from '@/lib/key-metadata';
import { normalizeMonitoredModels } from '@/lib/monitored-models';

interface Params {
  params: Promise<{ id: string; keyId: string }>;
}

/** 更新 key */
export async function PUT(request: Request, { params }: Params) {
  const { id, keyId } = await params;
  try {
    const upstreamId = Number(id);
    const numericKeyId = Number(keyId);
    const existing = await prisma.upstreamKey.findFirst({
      where: { id: numericKeyId, upstreamId },
      include: { upstream: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Key 不存在' }, { status: 404 });
    }

    const body = await request.json();
    const data = buildKeyUpdateData(body, encrypt);
    const models = body.monitoredModels === undefined ? null : normalizeMonitoredModels(body.monitoredModels);
    if (models && !models.some((model) => model.enabled)) {
      return NextResponse.json({ error: '每个分组至少需要启用一个监测模型' }, { status: 400 });
    }
    if (models) data.testModel = models.find((model) => model.enabled)?.modelName || null;

    const key = await prisma.$transaction(async (tx) => {
      const updated = await tx.upstreamKey.update({ where: { id: numericKeyId }, data });
      if (models) {
        for (const model of models) {
          await tx.monitoredModel.upsert({
            where: { upstreamKeyId_modelName: { upstreamKeyId: numericKeyId, modelName: model.modelName } },
            update: model,
            create: { upstreamKeyId: numericKeyId, ...model },
          });
        }
        await tx.monitoredModel.deleteMany({
          where: {
            upstreamKeyId: numericKeyId,
            ...(models.length ? { modelName: { notIn: models.map((model) => model.modelName) } } : {}),
          },
        });
      }
      return tx.upstreamKey.findUniqueOrThrow({
        where: { id: updated.id },
        include: { monitoredModels: { orderBy: { id: 'asc' } } },
      });
    });

    let responseKey = key;
    let metadataRefresh = null;
    if (existing.upstream.type === 'NEW_API') {
      try {
        const refreshed = await refreshKeyMetadata(key.id);
        responseKey = { ...key, ...refreshed.key, monitoredModels: key.monitoredModels };
        metadataRefresh = refreshed.result;
      } catch (error) {
        metadataRefresh = { ok: false, errorMessage: (error as Error).message };
      }
    }

    return NextResponse.json({ ...toSafeUpstreamKey(responseKey), metadataRefresh });
  } catch (e) {
    return NextResponse.json({ error: '更新失败: ' + (e as Error).message }, { status: 500 });
  }
}

/** 删除 key */
export async function DELETE(_req: Request, { params }: Params) {
  const { id, keyId } = await params;
  try {
    const numericKeyId = Number(keyId);
    const existing = await prisma.upstreamKey.findFirst({
      where: { id: numericKeyId, upstreamId: Number(id) },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Key 不存在' }, { status: 404 });
    }
    await prisma.upstreamKey.delete({ where: { id: numericKeyId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '删除失败: ' + (e as Error).message }, { status: 500 });
  }
}
