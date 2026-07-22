import { PrismaClient } from '@prisma/client';
import { getOfficialModelPrice } from '../src/lib/official-model-prices';

const prisma = new PrismaClient();

async function main() {
  await prisma.upstream.updateMany({ data: { testModel: null } });
  const models = await prisma.monitoredModel.findMany();
  for (const model of models) {
    const catalog = getOfficialModelPrice(model.modelName);
    if (!catalog) continue;
    const hasManualPrice = model.officialPriceSource === 'MANUAL'
      && (model.officialInputPrice != null || model.officialOutputPrice != null);
    if (hasManualPrice) continue;
    await prisma.monitoredModel.update({
      where: { id: model.id },
      data: {
        officialInputPrice: catalog.input,
        officialOutputPrice: catalog.output,
        officialPriceSource: catalog.source,
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
