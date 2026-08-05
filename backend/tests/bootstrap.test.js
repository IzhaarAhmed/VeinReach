import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAdminEmails, ensureAdmins } from '../src/services/bootstrap.service.js';
import { USER_ROLES, SELF_REGISTER_ROLES } from '../src/constants/index.js';

/**
 * The admin bootstrap is the only path to a first admin, and admin is the only
 * role that can verify hospitals and blood banks — so its parsing and its
 * refusal rules are worth pinning down. Anything requiring a database is
 * exercised separately; `npm test` stays runnable without one.
 */

test('admin list parses, trims, lowercases and de-duplicates', () => {
  assert.deepEqual(
    normalizeAdminEmails('  Alice@Example.com , bob@example.com ,alice@example.com'),
    ['alice@example.com', 'bob@example.com']
  );
});

test('admin list accepts an array as well as a comma string', () => {
  assert.deepEqual(normalizeAdminEmails(['A@b.co']), ['a@b.co']);
});

test('admin list ignores empty and malformed entries', () => {
  assert.deepEqual(normalizeAdminEmails(''), []);
  assert.deepEqual(normalizeAdminEmails(undefined), []);
  assert.deepEqual(normalizeAdminEmails(null), []);
  assert.deepEqual(normalizeAdminEmails(',,  ,'), []);
  // No '@' means it could never match a stored address; drop it rather than
  // issuing a pointless query.
  assert.deepEqual(normalizeAdminEmails('not-an-email, real@example.com'), [
    'real@example.com',
  ]);
});

test('an empty configuration touches nothing at all', async () => {
  // No DB connection is open here: proving it short-circuits before querying.
  const r = await ensureAdmins('');
  assert.deepEqual(r, { promoted: [], alreadyAdmin: [], missing: [], refused: [] });
});

test('admin remains a real role that cannot be self-registered', () => {
  assert.ok(USER_ROLES.includes('admin'), 'admin must exist as a role');
  assert.equal(
    SELF_REGISTER_ROLES.includes('admin'),
    false,
    'admin must never be selectable at registration — the bootstrap is the only path'
  );
});
