export class UpstreamApiKeyInputError extends Error {}

export function parseUpstreamApiKeyUpdates(input: unknown): Array<{ keyId: number; apiKey: string }> {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new UpstreamApiKeyInputError('API Key 更新必须为数组');

  const seen = new Set<number>();
  return input.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new UpstreamApiKeyInputError('API Key 更新格式不正确');
    }
    const { keyId, apiKey } = item as Record<string, unknown>;
    if (typeof keyId !== 'number' || !Number.isSafeInteger(keyId) || keyId <= 0 || seen.has(keyId)) {
      throw new UpstreamApiKeyInputError('分组 ID 无效或重复');
    }
    if (typeof apiKey !== 'string') throw new UpstreamApiKeyInputError('API Key 必须为字符串');
    seen.add(keyId);
    return apiKey.trim() ? [{ keyId, apiKey: apiKey.trim() }] : [];
  });
}
