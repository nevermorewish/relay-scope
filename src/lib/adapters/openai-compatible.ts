import type { AdapterContext, BalanceResult } from './base';
import { Sub2ApiAdapter } from './sub2api';
import type { UpstreamType } from '@/lib/domain-types';

/** 通用 OpenAI 兼容站点：复用模型与生成探测，不假设存在余额接口。 */
export class OpenAiCompatibleAdapter extends Sub2ApiAdapter {
  readonly type: UpstreamType = 'OPENAI_COMPATIBLE';

  async queryBalance(ctx: AdapterContext): Promise<BalanceResult> {
    void ctx;
    return { ok: false, supported: false };
  }
}
