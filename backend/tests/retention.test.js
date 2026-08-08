import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  purgeOldMessages,
  purgeOldNotifications,
  purgeOldAuditLogs,
  purgeOldRequests,
} from '../src/services/retention.service.js';
import { env } from '../src/config/env.js';

/**
 * Retention windows. The purge paths themselves need a database, but the
 * disable-guard runs before any query — which is what makes it testable here,
 * and worth testing: a guard that silently failed open would delete against the
 * default window instead of the operator's intent.
 */

/**
 * `undefined` is deliberately absent: it triggers the default parameter, which
 * means "use the configured window", not "disable". Only an explicit
 * non-positive number opts a category out.
 */
const NON_POSITIVE = [0, -1, Number.NaN];

test('a non-positive window disables that category without touching the database', async () => {
  // No connection is open. Reaching a query would throw or hang, so these
  // resolving at all is the assertion.
  for (const days of NON_POSITIVE) {
    assert.equal(await purgeOldNotifications(days), 0, `notifications: ${days}`);
    assert.equal(await purgeOldAuditLogs(days), 0, `audit logs: ${days}`);
    assert.equal(await purgeOldRequests(days), 0, `requests: ${days}`);
  }
});

test('disabling the message window skips attachments and conversations too', async () => {
  for (const days of NON_POSITIVE) {
    assert.deepEqual(await purgeOldMessages(days), {
      messages: 0,
      attachments: 0,
      conversations: 0,
    });
  }
});

test('the shipped defaults are the privacy-maximal ones', () => {
  // Guards against a default being widened by accident: the published policy
  // states these numbers, so changing one is a change to a promise.
  assert.equal(env.retention.messagesDays, 180); // 6 months
  assert.equal(env.retention.notificationsDays, 30);
  assert.equal(env.retention.auditDays, 365); // 12 months
  assert.equal(env.retention.requestsDays, 180); // 6 months
});

test('audit logs are retained at least as long as everything else', () => {
  // They are the only forensic record of a compromise or an abuse report, so
  // they must never be the first thing to disappear.
  const { auditDays, messagesDays, notificationsDays, requestsDays } = env.retention;
  assert.ok(auditDays >= messagesDays);
  assert.ok(auditDays >= notificationsDays);
  assert.ok(auditDays >= requestsDays);
});

test('the sweep is on by default', () => {
  // A retention policy nobody enforces is worse than none: it is a written
  // promise with no mechanism behind it.
  assert.equal(env.retention.enabled, true);
});
