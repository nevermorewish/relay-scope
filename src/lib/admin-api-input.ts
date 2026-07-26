import type { Prisma } from '@prisma/client';

export class AdminInputError extends Error {}

const alertMetrics = new Set(['balance', 'latency', 'consecutive_failures', 'availability']);
const alertOperators = new Set(['lt', 'gt', 'lte', 'gte']);
const alertSeverities = new Set(['INFO', 'WARNING', 'CRITICAL']);

export function parseAlertRuleCreate(value: unknown): Prisma.AlertRuleCreateInput {
  const body = requireRecord(value);
  rejectUnknownFields(body, ['name', 'metric', 'operator', 'threshold', 'severity', 'cooldownMin', 'enabled']);
  return {
    name: requireString(body.name, '规则名称', 100),
    metric: requireEnum(body.metric, '告警指标', alertMetrics),
    operator: optionalEnum(body.operator, '比较运算符', alertOperators) ?? 'lt',
    threshold: requireFiniteNumber(body.threshold, '告警阈值'),
    severity: optionalEnum(body.severity, '告警级别', alertSeverities) ?? 'WARNING',
    cooldownMin: optionalInteger(body.cooldownMin, '冷却时间', 1, 10080) ?? 30,
    enabled: optionalBoolean(body.enabled, '启用状态') ?? true,
  };
}

export function parseAlertRuleUpdate(value: unknown): Prisma.AlertRuleUpdateInput {
  const body = requireRecord(value);
  rejectUnknownFields(body, ['name', 'metric', 'operator', 'threshold', 'severity', 'cooldownMin', 'enabled']);
  const data: Prisma.AlertRuleUpdateInput = {};
  if ('name' in body) data.name = requireString(body.name, '规则名称', 100);
  if ('metric' in body) data.metric = requireEnum(body.metric, '告警指标', alertMetrics);
  if ('operator' in body) data.operator = requireEnum(body.operator, '比较运算符', alertOperators);
  if ('threshold' in body) data.threshold = requireFiniteNumber(body.threshold, '告警阈值');
  if ('severity' in body) data.severity = requireEnum(body.severity, '告警级别', alertSeverities);
  if ('cooldownMin' in body) data.cooldownMin = requireInteger(body.cooldownMin, '冷却时间', 1, 10080);
  if ('enabled' in body) data.enabled = requireBoolean(body.enabled, '启用状态');
  requireAtLeastOneField(data);
  return data;
}

export function parseAlertChannelCreate(value: unknown): Prisma.AlertChannelCreateInput {
  const body = requireRecord(value);
  rejectUnknownFields(body, ['name', 'type', 'config', 'enabled']);
  return {
    name: requireString(body.name, '渠道名称', 100),
    type: optionalLiteral(body.type, '渠道类型', 'feishu') ?? 'feishu',
    config: parseFeishuConfig(body.config),
    enabled: optionalBoolean(body.enabled, '启用状态') ?? true,
  };
}

export function parseAlertChannelUpdate(value: unknown): Prisma.AlertChannelUpdateInput {
  const body = requireRecord(value);
  rejectUnknownFields(body, ['name', 'type', 'config', 'enabled']);
  const data: Prisma.AlertChannelUpdateInput = {};
  if ('name' in body) data.name = requireString(body.name, '渠道名称', 100);
  if ('type' in body) data.type = requireLiteral(body.type, '渠道类型', 'feishu');
  if ('config' in body) data.config = parseFeishuConfig(body.config);
  if ('enabled' in body) data.enabled = requireBoolean(body.enabled, '启用状态');
  requireAtLeastOneField(data);
  return data;
}

export function toSafeAlertChannel<T extends { config: unknown }>(channel: T) {
  const config = isRecord(channel.config) ? channel.config : {};
  const webhookUrl = typeof config.webhookUrl === 'string' ? config.webhookUrl : '';
  return {
    ...channel,
    config: {
      webhookUrl: summarizeWebhookUrl(webhookUrl),
      hasSecret: typeof config.secret === 'string' && config.secret.length > 0,
    },
  };
}

const settingValidators: Record<string, (value: unknown) => string> = {
  light_interval_minutes: (value) => String(requireInteger(value, '轻量采集间隔', 1, 1440)),
  heavy_interval_minutes: (value) => String(requireInteger(value, '重量采集间隔', 5, 10080)),
  test_timeout_ms: (value) => String(requireInteger(value, '测试超时', 1000, 300000)),
  retention_days: (value) => String(requireInteger(value, '数据保留天数', 1, 3650)),
  cron_secret: (value) => {
    if (typeof value !== 'string') throw new AdminInputError('定时任务密钥必须是字符串');
    const secret = value.trim();
    if (secret && secret.length < 16) throw new AdminInputError('定时任务密钥至少需要 16 个字符');
    if (secret.length > 512) throw new AdminInputError('定时任务密钥过长');
    return secret;
  },
};

export function parseSettingsUpdate(value: unknown): Record<string, string> {
  const body = requireRecord(value);
  rejectUnknownFields(body, Object.keys(settingValidators));
  const result: Record<string, string> = {};
  for (const [key, settingValue] of Object.entries(body)) {
    result[key] = settingValidators[key](settingValue);
  }
  requireAtLeastOneField(result);
  return result;
}

export function parsePositiveId(value: string, label = 'ID'): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AdminInputError(`${label} 无效`);
  return id;
}

function parseFeishuConfig(value: unknown): Prisma.InputJsonObject {
  const config = requireRecord(value, '飞书配置无效');
  rejectUnknownFields(config, ['webhookUrl', 'secret']);
  const webhookUrl = requireString(config.webhookUrl, 'Webhook URL', 2048);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    throw new AdminInputError('Webhook URL 无效');
  }
  if (parsedUrl.protocol !== 'https:') throw new AdminInputError('Webhook URL 必须使用 HTTPS');

  const result: Record<string, Prisma.InputJsonValue> = { webhookUrl };
  if (config.secret != null && config.secret !== '') {
    result.secret = requireString(config.secret, '签名密钥', 512);
  }
  return result;
}

function summarizeWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    const token = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
    return `${url.origin}/.../${token.slice(-6).padStart(6, '*')}`;
  } catch {
    return value ? '已配置' : '';
  }
}

function requireRecord(value: unknown, message = '请求内容无效'): Record<string, unknown> {
  if (!isRecord(value)) throw new AdminInputError(message);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownFields(body: Record<string, unknown>, allowed: string[]) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(body).find((key) => !allowedSet.has(key));
  if (unknown) throw new AdminInputError(`不支持字段：${unknown}`);
}

function requireAtLeastOneField(value: object) {
  if (Object.keys(value).length === 0) throw new AdminInputError('至少需要提供一个可更新字段');
}

function requireString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new AdminInputError(`${label}不能为空`);
  const result = value.trim();
  if (result.length > maxLength) throw new AdminInputError(`${label}过长`);
  return result;
}

function requireFiniteNumber(value: unknown, label: string): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new AdminInputError(`${label}必须是有效数字`);
  return number;
}

function requireInteger(value: unknown, label: string, min: number, max: number): number {
  const number = requireFiniteNumber(value, label);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new AdminInputError(`${label}必须是 ${min} 到 ${max} 之间的整数`);
  }
  return number;
}

function optionalInteger(value: unknown, label: string, min: number, max: number) {
  return value == null ? undefined : requireInteger(value, label, min, max);
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new AdminInputError(`${label}必须是布尔值`);
  return value;
}

function optionalBoolean(value: unknown, label: string) {
  return value == null ? undefined : requireBoolean(value, label);
}

function requireEnum(value: unknown, label: string, allowed: Set<string>): string {
  if (typeof value !== 'string' || !allowed.has(value)) throw new AdminInputError(`${label}无效`);
  return value;
}

function optionalEnum(value: unknown, label: string, allowed: Set<string>) {
  return value == null ? undefined : requireEnum(value, label, allowed);
}

function requireLiteral(value: unknown, label: string, expected: string): string {
  if (value !== expected) throw new AdminInputError(`${label}无效`);
  return expected;
}

function optionalLiteral(value: unknown, label: string, expected: string) {
  return value == null ? undefined : requireLiteral(value, label, expected);
}
