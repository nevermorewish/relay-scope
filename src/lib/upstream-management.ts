export type ConfigurationState = 'READY' | 'NEEDS_CONFIG';

export interface ManagementKeyInput {
  enabled: boolean;
  hasApiKey: boolean;
  hasAccessToken: boolean;
  userId?: string | null;
  testModel?: string | null;
  lastCollectedAt?: Date | string | null;
  lastError?: string | null;
  metadataError?: string | null;
  monitoredModels?: Array<{
    modelName: string;
    enabled: boolean;
    latestTest?: {
      ok: boolean | null;
      errorMessage: string | null;
      recordedAt: Date | string;
    } | null;
  }>;
}

export interface ManagementUpstreamInput {
  type: string;
  enabled: boolean;
  testModel?: string | null;
  keys?: ManagementKeyInput[];
}

export interface ConfigurationHealth {
  state: ConfigurationState;
  enabledGroupCount: number;
  modelNames: string[];
  credentialComplete: boolean;
  latestCollectedAt: string | null;
  errorMessage: string | null;
}

export interface ManagementSummary {
  total: number;
  enabled: number;
  credentialsReady: number;
  pending: number;
  latestCollectedAt: string | null;
}

export function evaluateConfiguration(upstream: ManagementUpstreamInput): ConfigurationHealth {
  const keys = (upstream.keys || []).filter((key) => key.enabled);
  const modelNames = unique(keys.flatMap((key) => {
    const monitored = (key.monitoredModels || []).filter((model) => model.enabled).map((model) => model.modelName.trim()).filter(Boolean);
    return monitored.length ? monitored : [key.testModel?.trim() || ''].filter(Boolean);
  }));
  const credentialComplete = keys.length > 0 && keys.every((key) => hasRequiredCredentials(upstream.type, key));
  const latestTests = keys.flatMap((key) => (
    (key.monitoredModels || [])
      .filter((model) => model.enabled && model.latestTest)
      .map((model) => model.latestTest!)
  ));
  const errorMessage = latestTests.find((test) => test.ok === false)?.errorMessage
    || (latestTests.some((test) => test.ok === false) ? '最近一次真实模型测试失败' : null);
  const latestCollectedAt = latestDate(latestTests.map((test) => test.recordedAt));

  if (keys.length === 0 || !credentialComplete || modelNames.length === 0) {
    return { state: 'NEEDS_CONFIG', enabledGroupCount: keys.length, modelNames, credentialComplete, latestCollectedAt, errorMessage };
  }
  return { state: 'READY', enabledGroupCount: keys.length, modelNames, credentialComplete, latestCollectedAt, errorMessage };
}

export function buildManagementSummary(upstreams: ManagementUpstreamInput[]): ManagementSummary {
  const health = upstreams.map(evaluateConfiguration);
  const enabled = upstreams.filter((upstream) => upstream.enabled).length;
  return {
    total: upstreams.length,
    enabled,
    credentialsReady: health.filter((item, index) => upstreams[index].enabled && item.credentialComplete).length,
    pending: health.filter((item) => item.state === 'NEEDS_CONFIG').length,
    latestCollectedAt: latestDate(health.map((item) => item.latestCollectedAt)),
  };
}

export function configurationLabel(state: ConfigurationState) {
  return state === 'READY' ? '配置完整'
    : '需配置';
}

function hasRequiredCredentials(type: string, key: ManagementKeyInput) {
  if (type === 'NEW_API') return key.hasApiKey && key.hasAccessToken && Boolean(key.userId?.trim());
  return key.hasApiKey;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function latestDate(values: Array<Date | string | null | undefined>) {
  const dates = values
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => Number.isFinite(value.getTime()));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((value) => value.getTime()))).toISOString();
}
