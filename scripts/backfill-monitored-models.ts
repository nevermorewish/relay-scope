import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const keys = await prisma.upstreamKey.findMany({ include: { upstream: true } });
  for (const key of keys) {
    const modelName = key.testModel || key.upstream.testModel;
    if (!modelName) continue;
    await prisma.monitoredModel.upsert({
      where: { upstreamKeyId_modelName: { upstreamKeyId: key.id, modelName } },
      update: {},
      create: { upstreamKeyId: key.id, modelName },
    });
  }
}

main().finally(() => prisma.$disconnect());
