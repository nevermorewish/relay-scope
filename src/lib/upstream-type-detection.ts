import type { UpstreamType } from '@/lib/domain-types';

interface DetectionCredentials {
  apiKey?: string;
  accessToken?: string;
  userId?: string;
}

export async function detectUpstreamType(
  rawBaseUrl: string,
  credentials: DetectionCredentials = {},
  fallback: UpstreamType = 'SUB2API',
): Promise<UpstreamType> {
  if (credentials.accessToken && credentials.userId) return 'NEW_API';

  const baseUrl = normalizeProbeBaseUrl(rawBaseUrl);
  const status = await probe(`${baseUrl}/api/status`);
  if (looksLikeNewApiStatus(status.body)) return 'NEW_API';

  if (credentials.apiKey) {
    const usage = await probe(`${baseUrl}/v1/usage`, credentials.apiKey);
    if (usage.ok && looksLikeSub2ApiUsage(usage.body)) return 'SUB2API';
    if (usage.status === 404 || usage.status === 405) return 'OPENAI_COMPATIBLE';
  }

  return fallback;
}

function normalizeProbeBaseUrl(raw: string) {
  let value = raw.trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  return value;
}

async function probe(url: string, apiKey?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

function looksLikeNewApiStatus(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  const data = row.data;
  if (row.success !== true || !data || typeof data !== 'object') return false;
  const fields = data as Record<string, unknown>;
  return 'system_name' in fields || 'version' in fields || 'quota_per_unit' in fields;
}

function looksLikeSub2ApiUsage(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return 'remaining' in row || 'balance' in row || 'quota' in row || 'subscription' in row;
}
