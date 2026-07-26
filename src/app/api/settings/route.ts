import { NextResponse } from 'next/server';
import {
  SettingKeys,
  clearSettingsCache,
  getCronSecret,
  getSetting,
  setSetting,
} from '@/lib/settings';
import { AdminInputError, parseSettingsUpdate } from '@/lib/admin-api-input';

export const dynamic = 'force-dynamic';

/** 获取所有设置 */
export async function GET() {
  const [lightInterval, heavyInterval, testTimeout, retentionDays, cronSecret] = await Promise.all([
    getSetting(SettingKeys.LIGHT_INTERVAL_MIN, '1'),
    getSetting(SettingKeys.HEAVY_INTERVAL_MIN, '15'),
    getSetting(SettingKeys.TEST_TIMEOUT_MS, '30000'),
    getSetting(SettingKeys.RETENTION_DAYS, '30'),
    getCronSecret(),
  ]);
  return NextResponse.json({
    [SettingKeys.LIGHT_INTERVAL_MIN]: lightInterval,
    [SettingKeys.HEAVY_INTERVAL_MIN]: heavyInterval,
    [SettingKeys.TEST_TIMEOUT_MS]: testTimeout,
    [SettingKeys.RETENTION_DAYS]: retentionDays,
    cron_secret_configured: String(Boolean(cronSecret)),
  });
}

/** 批量更新设置（键值对） */
export async function PUT(request: Request) {
  try {
    const body = parseSettingsUpdate(await request.json());
    for (const [key, value] of Object.entries(body)) {
      await setSetting(key, value);
    }
    clearSettingsCache();
    return NextResponse.json({ ok: true, cronSecretConfigured: Boolean(await getCronSecret()) });
  } catch (e) {
    if (e instanceof AdminInputError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '更新失败: ' + (e as Error).message }, { status: 500 });
  }
}
