import { MODEL_CATALOG_DOCUMENT } from './official-model-prices';
import type { ModelCatalogEntry } from './model-catalog-schema';

export type ModelCatalogModel = ModelCatalogEntry;

export const MODEL_CATALOG_MODELS: ReadonlyArray<ModelCatalogModel> = MODEL_CATALOG_DOCUMENT.models;

export const MODEL_CATALOG_METADATA: Readonly<Record<string, Pick<ModelCatalogModel, 'input' | 'releaseDate'>>> = Object.fromEntries(
  MODEL_CATALOG_MODELS.map((model) => [`${model.provider}:${model.id}`, { input: model.input, releaseDate: model.releaseDate }]),
);
