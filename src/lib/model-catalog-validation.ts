import {
  SUPPORTED_MODEL_PROVIDERS,
  type CatalogCurrencyPrice,
  type CatalogPriceTier,
  type ModelCatalogDocument,
} from './model-catalog-schema';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
const INPUT_MODALITIES = new Set(['text', 'image', 'pdf', 'audio', 'video']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableNonNegative(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isNullablePositive(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function validateTier(tier: CatalogPriceTier, path: string, errors: string[]) {
  if (!tier.label?.trim()) errors.push(`${path}.label must be non-empty`);
  if (!isNullableNonNegative(tier.input)) errors.push(`${path}.input must be null or non-negative`);
  if (!isNullableNonNegative(tier.output)) errors.push(`${path}.output must be null or non-negative`);
  if ((tier.input == null) !== (tier.output == null)) errors.push(`${path} input/output must be provided together`);
  if (tier.cacheRead !== undefined && !isNullableNonNegative(tier.cacheRead)) errors.push(`${path}.cacheRead must be null or non-negative`);
  if (tier.cacheWrite !== undefined && !isNullableNonNegative(tier.cacheWrite)) errors.push(`${path}.cacheWrite must be null or non-negative`);
  if (tier.minInputTokens !== undefined && (!Number.isInteger(tier.minInputTokens) || tier.minInputTokens < 0)) {
    errors.push(`${path}.minInputTokens must be a non-negative integer`);
  }
  if (tier.maxInputTokens !== undefined && (!Number.isInteger(tier.maxInputTokens) || tier.maxInputTokens <= 0)) {
    errors.push(`${path}.maxInputTokens must be a positive integer`);
  }
  if (tier.minInputTokens !== undefined && tier.maxInputTokens !== undefined && tier.minInputTokens > tier.maxInputTokens) {
    errors.push(`${path} token range is inverted`);
  }
}

function validateCurrencyPrice(price: CatalogCurrencyPrice, path: string, errors: string[]) {
  for (const field of ['input', 'output', 'cacheRead', 'cacheWrite'] as const) {
    if (!isNullableNonNegative(price[field])) errors.push(`${path}.${field} must be null or non-negative`);
  }
  if ((price.input == null) !== (price.output == null)) errors.push(`${path} input/output must be provided together`);
  if (price.tiers !== undefined) {
    if (!Array.isArray(price.tiers) || price.tiers.length === 0) errors.push(`${path}.tiers must be a non-empty array when present`);
    else price.tiers.forEach((tier, index) => validateTier(tier, `${path}.tiers[${index}]`, errors));
  }
}

export function validateModelCatalog(input: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(input)) return ['catalog must be an object'];
  const catalog = input as unknown as ModelCatalogDocument;

  if (catalog.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (typeof catalog.catalogVersion !== 'string' || !VERSION_PATTERN.test(catalog.catalogVersion)) {
    errors.push('catalogVersion must use YYYY.MM.DD.N format');
  }
  if (typeof catalog.updatedAt !== 'string' || !DATE_PATTERN.test(catalog.updatedAt)) {
    errors.push('updatedAt must use YYYY-MM-DD format');
  }
  if (typeof catalog.usdToCnyRate !== 'number' || !Number.isFinite(catalog.usdToCnyRate) || catalog.usdToCnyRate <= 0) {
    errors.push('usdToCnyRate must be positive');
  }

  const providerNames = new Set<string>();
  if (!Array.isArray(catalog.providers)) errors.push('providers must be an array');
  else {
    for (let index = 0; index < catalog.providers.length; index += 1) {
      const provider = catalog.providers[index];
      if (!SUPPORTED_MODEL_PROVIDERS.includes(provider.name)) errors.push(`providers[${index}].name is unsupported`);
      if (providerNames.has(provider.name)) errors.push(`duplicate provider: ${provider.name}`);
      providerNames.add(provider.name);
      if (typeof provider.officialUrl !== 'string' || !provider.officialUrl.startsWith('https://')) {
        errors.push(`providers[${index}].officialUrl must use HTTPS`);
      }
    }
  }
  for (const provider of SUPPORTED_MODEL_PROVIDERS) {
    if (!providerNames.has(provider)) errors.push(`missing provider: ${provider}`);
  }

  const priceIds = new Set<string>();
  const priceKeys = new Set<string>();
  if (!Array.isArray(catalog.prices)) errors.push('prices must be an array');
  else {
    for (let index = 0; index < catalog.prices.length; index += 1) {
      const price = catalog.prices[index];
      const path = `prices[${index}]`;
      if (!price.id?.trim()) errors.push(`${path}.id must be non-empty`);
      if (priceIds.has(price.id)) errors.push(`duplicate price id: ${price.id}`);
      priceIds.add(price.id);
      const key = `${price.provider}:${price.id}`;
      if (priceKeys.has(key)) errors.push(`duplicate price record: ${key}`);
      priceKeys.add(key);
      if (!providerNames.has(price.provider)) errors.push(`${path}.provider is unsupported`);
      validateCurrencyPrice(price.usd, `${path}.usd`, errors);
      validateCurrencyPrice(price.cny, `${path}.cny`, errors);
      if (price.usd.input == null && price.cny.input == null) errors.push(`${path} has no price in either currency`);
      if (!isNullablePositive(price.contextWindow)) errors.push(`${path}.contextWindow must be null or positive`);
      if (!isNullablePositive(price.maxOutput)) errors.push(`${path}.maxOutput must be null or positive`);
      if (typeof price.officialUrl !== 'string' || !price.officialUrl.startsWith('https://')) {
        errors.push(`${path}.officialUrl must use HTTPS`);
      }
      if (typeof price.verifiedAt !== 'string' || !DATE_PATTERN.test(price.verifiedAt)) {
        errors.push(`${path}.verifiedAt must use YYYY-MM-DD format`);
      }
    }
  }

  if (!isRecord(catalog.aliases)) errors.push('aliases must be an object');
  else {
    for (const [alias, target] of Object.entries(catalog.aliases)) {
      if (!alias.trim()) errors.push('alias keys must be non-empty');
      if (typeof target !== 'string' || !priceIds.has(target)) errors.push(`alias target does not exist: ${alias} -> ${String(target)}`);
    }
  }

  const modelKeys = new Set<string>();
  if (!Array.isArray(catalog.models)) errors.push('models must be an array');
  else {
    for (let index = 0; index < catalog.models.length; index += 1) {
      const model = catalog.models[index];
      const path = `models[${index}]`;
      const key = `${model.provider}:${model.id}`;
      if (modelKeys.has(key)) errors.push(`duplicate model record: ${key}`);
      modelKeys.add(key);
      if (!model.id?.trim()) errors.push(`${path}.id must be non-empty`);
      if (!model.name?.trim()) errors.push(`${path}.name must be non-empty`);
      if (!providerNames.has(model.provider)) errors.push(`${path}.provider is unsupported`);
      if (typeof model.sourceProvider !== 'string' || !/^[a-z]+$/.test(model.sourceProvider)) {
        errors.push(`${path}.sourceProvider must use lowercase letters`);
      }
      if (!Array.isArray(model.input) || model.input.length === 0 || model.input.some((item) => !INPUT_MODALITIES.has(item))) {
        errors.push(`${path}.input contains an unsupported modality`);
      }
      if (!isNullablePositive(model.contextWindow)) errors.push(`${path}.contextWindow must be null or positive`);
      if (!isNullablePositive(model.maxOutput)) errors.push(`${path}.maxOutput must be null or positive`);
      if (typeof model.releaseDate !== 'string' || !DATE_PATTERN.test(model.releaseDate)) {
        errors.push(`${path}.releaseDate must use YYYY-MM-DD format`);
      }
      const priceId = model.priceId ?? model.id;
      if (model.priceId && !priceKeys.has(`${model.provider}:${priceId}`)) {
        errors.push(`${path}.priceId does not reference a price from the same provider`);
      }
    }
  }

  return errors;
}
