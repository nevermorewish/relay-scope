import { NextResponse } from 'next/server';
import { getAdapter } from '@/lib/adapters/registry';
import type { AdapterContext } from '@/lib/adapters/base';
import { getCollectConfig } from '@/lib/settings';
import { detectUpstreamType } from '@/lib/upstream-type-detection';

/** 新建上游前临时读取模型，不保存地址或凭证。 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const baseUrl = typeof body.baseUrl === 'string' ? normalizeBaseUrl(body.baseUrl) : '';
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: '请先填写站点地址和 API Key' }, { status: 400 });
    }

    const [type, config] = await Promise.all([
      detectUpstreamType(baseUrl, { apiKey }),
      getCollectConfig(),
    ]);
    const adapter = getAdapter(type);
    const context: AdapterContext = {
      baseUrl,
      apiKey,
      timeoutMs: config.timeoutMs,
      testModel: config.testModel,
    };
    const result = await adapter.listModels(context);
    if (!result.ok) {
      return NextResponse.json({ error: result.errorMessage || '读取模型失败' }, { status: 502 });
    }

    const models = Array.from(new Set((result.models || []).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ models, type });
  } catch (error) {
    return NextResponse.json({ error: '读取模型失败: ' + (error as Error).message }, { status: 500 });
  }
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
}
