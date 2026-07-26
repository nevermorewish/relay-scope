import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdminInputError,
  parseAlertChannelCreate,
  parseAlertRuleUpdate,
  parseSettingsUpdate,
  toSafeAlertChannel,
} from './admin-api-input';

test('accepts supported settings and normalizes them for storage', () => {
  assert.deepEqual(parseSettingsUpdate({
    light_interval_minutes: '2',
    test_timeout_ms: 45000,
    cron_secret: ' 1234567890abcdef ',
  }), {
    light_interval_minutes: '2',
    test_timeout_ms: '45000',
    cron_secret: '1234567890abcdef',
  });
});

test('rejects unknown settings and unsafe interval values', () => {
  assert.throws(() => parseSettingsUpdate({ arbitrary_key: 'value' }), AdminInputError);
  assert.throws(() => parseSettingsUpdate({ heavy_interval_minutes: 1 }), AdminInputError);
});

test('only accepts known alert-rule fields and operators', () => {
  assert.deepEqual(parseAlertRuleUpdate({ operator: 'gte', enabled: false }), {
    operator: 'gte',
    enabled: false,
  });
  assert.throws(() => parseAlertRuleUpdate({ operator: 'equals' }), AdminInputError);
  assert.throws(() => parseAlertRuleUpdate({ id: 10 }), AdminInputError);
});

test('validates webhook configuration and removes secrets from API output', () => {
  const input = parseAlertChannelCreate({
    name: ' Operations ',
    type: 'feishu',
    config: {
      webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/secret-token-123456',
      secret: 'SEC-secret',
    },
  });
  assert.equal(input.name, 'Operations');

  const safe = toSafeAlertChannel({ id: 1, config: input.config });
  assert.equal(safe.config.webhookUrl, 'https://open.feishu.cn/.../123456');
  assert.equal(safe.config.hasSecret, true);
  assert.equal(JSON.stringify(safe).includes('secret-token'), false);
  assert.equal(JSON.stringify(safe).includes('SEC-secret'), false);
});

test('requires HTTPS webhook targets', () => {
  assert.throws(() => parseAlertChannelCreate({
    name: 'Webhook',
    config: { webhookUrl: 'http://example.com/hook/token' },
  }), AdminInputError);
});
