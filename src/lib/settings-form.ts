export function buildSettingsUpdatePayload(
  settings: Record<string, string>,
  includeCronSecret: boolean
): Record<string, string> {
  const payload = { ...settings };
  delete payload.cron_secret_configured;
  if (!includeCronSecret) delete payload.cron_secret;
  return payload;
}
