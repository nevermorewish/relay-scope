import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSettingsUpdatePayload } from './settings-form';

test('omits secret metadata and unchanged cron credentials from settings updates', () => {
  assert.deepEqual(buildSettingsUpdatePayload({
    light_interval_minutes: '1',
    cron_secret: '',
    cron_secret_configured: 'true',
  }, false), {
    light_interval_minutes: '1',
  });
});

test('includes a cron credential only after the user changes it', () => {
  assert.deepEqual(buildSettingsUpdatePayload({
    cron_secret: '1234567890abcdef',
    cron_secret_configured: 'true',
  }, true), {
    cron_secret: '1234567890abcdef',
  });
});
