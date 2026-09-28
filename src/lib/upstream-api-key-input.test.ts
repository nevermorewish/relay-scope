import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUpstreamApiKeyUpdates, UpstreamApiKeyInputError } from './upstream-api-key-input';

test('preserves existing credentials when updates are omitted or left blank', () => {
  assert.deepEqual(parseUpstreamApiKeyUpdates(undefined), []);
  assert.deepEqual(parseUpstreamApiKeyUpdates([{ keyId: 1, apiKey: '   ' }]), []);
});

test('normalizes replacements for separate groups and ignores extra fields', () => {
  assert.deepEqual(parseUpstreamApiKeyUpdates([
    { keyId: 1, apiKey: ' sk-first ', upstreamId: 99, accessToken: 'ignored' },
    { keyId: 2, apiKey: 'sk-second' },
  ]), [{ keyId: 1, apiKey: 'sk-first' }, { keyId: 2, apiKey: 'sk-second' }]);
});

test('rejects malformed credentials and ambiguous group identifiers', () => {
  for (const input of [
    null, {}, [null], [[]], [{ keyId: '1', apiKey: 'key' }],
    [{ keyId: 0, apiKey: 'key' }], [{ keyId: 1.5, apiKey: 'key' }],
    [{ keyId: 1, apiKey: null }], [{ keyId: 1, apiKey: {} }],
    [{ keyId: 1, apiKey: 'first' }, { keyId: 1, apiKey: 'second' }],
  ]) {
    assert.throws(() => parseUpstreamApiKeyUpdates(input), UpstreamApiKeyInputError);
  }
});
