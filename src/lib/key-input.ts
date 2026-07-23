export interface UpstreamKeyInput {
  group?: string;
  label?: string;
  apiKey?: string;
  accessToken?: string;
  userId?: string;
  testModel?: string;
  enabled?: boolean;
  groupRateMultiplier?: number | null;
}

export function resolveInheritedBalanceCredentials(
  keys: Array<{ accessTokenEnc: string | null; userId: string | null }>,
) {
  return {
    accessTokenEnc: keys.find((key) => key.accessTokenEnc)?.accessTokenEnc || null,
    userId: keys.find((key) => key.userId?.trim())?.userId || null,
  };
}

export function buildKeyUpdateData(
  input: UpstreamKeyInput,
  encryptValue: (value: string) => string
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (input.group !== undefined) data.group = input.group;
  if (input.label !== undefined) data.label = input.label || null;
  if (input.userId !== undefined) data.userId = input.userId || null;
  if (input.testModel !== undefined) data.testModel = input.testModel || null;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.groupRateMultiplier !== undefined) data.groupRateMultiplier = input.groupRateMultiplier;
  if (input.apiKey !== undefined) data.apiKeyEnc = input.apiKey ? encryptValue(input.apiKey) : null;
  if (input.accessToken !== undefined) {
    data.accessTokenEnc = input.accessToken ? encryptValue(input.accessToken) : null;
  }

  return data;
}
