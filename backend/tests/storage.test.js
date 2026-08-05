import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKey, publicUrl } from '../src/services/storage.service.js';
import { pairKeyFor } from '../src/models/conversation.model.js';

test('buildKey namespaces by purpose + owner and picks the right extension', () => {
  const key = buildKey('profile_image', 'user123', 'image/png');
  assert.match(key, /^profile_image\/user123\/\d+-[0-9a-f]{16}\.png$/);
});

test('buildKey maps content types to extensions', () => {
  assert.ok(buildKey('chat_attachment', 'u', 'application/pdf').endsWith('.pdf'));
  assert.ok(buildKey('chat_attachment', 'u', 'image/jpeg').endsWith('.jpg'));
  assert.ok(buildKey('chat_attachment', 'u', 'image/webp').endsWith('.webp'));
  assert.ok(buildKey('chat_attachment', 'u', 'application/x-weird').endsWith('.bin'));
});

test('buildKey keys are unique per call', () => {
  const a = buildKey('verification_doc', 'u', 'application/pdf');
  const b = buildKey('verification_doc', 'u', 'application/pdf');
  assert.notEqual(a, b);
});

test('publicUrl returns null when no public base is configured', () => {
  // R2_PUBLIC_URL is unset in the test env.
  assert.equal(publicUrl('profile_image/u/x.png'), null);
  assert.equal(publicUrl(''), null);
});

test('pairKeyFor is order-independent', () => {
  assert.equal(pairKeyFor('a', 'b'), pairKeyFor('b', 'a'));
  assert.equal(pairKeyFor('a', 'b'), 'a:b');
});
