import { getOfficialModelPrice } from './official-model-prices';

export interface EditableGroupModel {
  clientId: string;
  modelName: string;
  officialInputPrice: string;
  officialOutputPrice: string;
  enabled: boolean;
}

export interface StoredGroupModel {
  id: number;
  modelName: string;
  officialInputPrice: number | null;
  officialOutputPrice: number | null;
  enabled: boolean;
}

export interface GroupFormValues {
  group: string;
  label: string;
  userId: string;
  groupRateMultiplier: string;
  apiKey: string;
  apiKeyDirty: boolean;
  accessToken: string;
  accessTokenDirty: boolean;
  isEditing: boolean;
  hasApiKey: boolean;
  models: EditableGroupModel[];
}

export function createEmptyGroupModel(): EditableGroupModel {
  return {
    clientId: `new-${Date.now()}-${Math.random()}`,
    modelName: '',
    officialInputPrice: '',
    officialOutputPrice: '',
    enabled: true,
  };
}

export function createInitialGroupModels(models?: StoredGroupModel[] | null): EditableGroupModel[] {
  if (!models?.length) return [createEmptyGroupModel()];
  return models.map((model) => ({
    clientId: `saved-${model.id}`,
    modelName: model.modelName,
    officialInputPrice: model.officialInputPrice == null ? '' : String(model.officialInputPrice),
    officialOutputPrice: model.officialOutputPrice == null ? '' : String(model.officialOutputPrice),
    enabled: model.enabled,
  }));
}

export function validateGroupForm(values: GroupFormValues) {
  if (!values.group.trim()) throw new Error('请填写分组名');
  if (!values.hasApiKey && !values.apiKey.trim()) throw new Error('请填写 API Key');
  if (values.groupRateMultiplier !== '') {
    const multiplier = Number(values.groupRateMultiplier);
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      throw new Error('倍率必须是大于或等于 0 的数字');
    }
  }

  const enabledModels = values.models.filter((model) => model.enabled);
  if (enabledModels.length === 0) throw new Error('请至少启用一个监测模型');
  const names = new Set<string>();
  for (const model of enabledModels) {
    const name = model.modelName.trim();
    if (!name) throw new Error('请填写启用模型的名称');
    if (names.has(name)) throw new Error(`模型「${name}」重复`);
    names.add(name);
    if (!getOfficialModelPrice(name)) {
      validateManualPrice(name, '输入', model.officialInputPrice);
      validateManualPrice(name, '输出', model.officialOutputPrice);
    }
  }
}

export function buildGroupRequestBody(values: GroupFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    group: values.group.trim(),
    label: values.label.trim(),
    groupRateMultiplier: values.groupRateMultiplier === '' ? null : Number(values.groupRateMultiplier),
    monitoredModels: values.models
      .filter((model) => model.modelName.trim())
      .map((model) => ({
        modelName: model.modelName.trim(),
        officialInputPrice: model.officialInputPrice === '' ? null : Number(model.officialInputPrice),
        officialOutputPrice: model.officialOutputPrice === '' ? null : Number(model.officialOutputPrice),
        enabled: model.enabled,
      })),
  };
  if (values.isEditing) body.userId = values.userId.trim();
  else body.enabled = true;
  if ((!values.isEditing || values.apiKeyDirty) && values.apiKey.trim()) {
    body.apiKey = values.apiKey.trim();
  }
  if (values.isEditing && values.accessTokenDirty && values.accessToken.trim()) {
    body.accessToken = values.accessToken.trim();
  }
  return body;
}

function validateManualPrice(modelName: string, label: string, value: string) {
  const price = Number(value);
  if (value === '' || !Number.isFinite(price) || price < 0) {
    throw new Error(`模型「${modelName}」未匹配内置价格，请填写官方${label}价`);
  }
}
