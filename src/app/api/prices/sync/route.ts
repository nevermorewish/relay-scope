import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdapter } from '@/lib/adapters/registry';
import { tryDecrypt } from '@/lib/crypto';
import { getCollectConfig } from '@/lib/settings';
import type { Prisma } from '@prisma/client';
import type { UpstreamType } from '@/lib/domain-types';

export async function POST() {
  const config = await getCollectConfig();
  const keys = await prisma.upstreamKey.findMany({
    where: { enabled: true, upstream: { enabled: true, type: 'NEW_API' } },
    include: { upstream: true },
  });
  let synced = 0;
  const errors: string[] = [];
  for (const key of keys) {
    const apiKey = key.apiKeyEnc ? tryDecrypt(key.apiKeyEnc) : '';
    const adapter = getAdapter(key.upstream.type as UpstreamType);
    if (!adapter.queryPricing) continue;
    const result = await adapter.queryPricing({
      baseUrl: key.upstream.baseUrl,
      apiKey: apiKey || '',
      timeoutMs: config.timeoutMs,
      testModel: key.testModel || key.upstream.testModel || config.testModel,
      groupName: key.groupName || key.group,
    });
    if (!result.ok || !result.prices) {
      errors.push(`${key.upstream.name}/${key.group}: ${result.errorMessage || '同步失败'}`);
      continue;
    }
    await prisma.priceSnapshot.createMany({
      data: result.prices.map((price) => ({
        upstreamId: key.upstreamId,
        upstreamKeyId: key.id,
        modelName: price.modelName,
        currency: price.currency,
        inputPrice: price.inputPrice,
        outputPrice: price.outputPrice,
        cacheReadPrice: price.cacheReadPrice,
        cacheWritePrice: price.cacheWritePrice,
        fixedPrice: price.fixedPrice,
        source: 'AUTO',
        rawData: price.rawData as Prisma.InputJsonValue | undefined,
      })),
    });
    synced += result.prices.length;
  }
  return NextResponse.json({ synced, errors });
}
