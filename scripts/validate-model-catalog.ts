import catalog from '../data/model-catalog.json';
import { validateModelCatalog } from '../src/lib/model-catalog-validation';

const errors = validateModelCatalog(catalog);

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Model catalog ${catalog.catalogVersion} is valid (${catalog.models.length} models, ${catalog.prices.length} price records).`);
}
