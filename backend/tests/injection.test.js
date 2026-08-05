import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoSanitize from 'express-mongo-sanitize';
import { VERIFICATION_STATUS, REPORT_STATUS, USER_ROLES } from '../src/constants/index.js';

/**
 * NoSQL operator injection.
 *
 * Most routes validate with Zod, but the admin directory, report list and audit
 * trail pass `req.query` straight into a Mongo filter. Two layers now stand in
 * the way — the sanitizer middleware, and value whitelists in the services —
 * and these assertions pin both down.
 */

/** Mirrors how Express would parse `?verification[$ne]=verified`. */
const hostileQuery = () => ({
  verification: { $ne: 'verified' },
  status: { $gt: '' },
  role: { $ne: 'admin' },
  action: { $regex: '.*' },
  q: 'harmless',
});

test('sanitizer strips Mongo operators out of query objects', () => {
  const req = { query: hostileQuery(), body: {}, params: {} };
  // The middleware mutates in place; invoke it the way Express would.
  mongoSanitize()(req, {}, () => {});

  assert.deepEqual(req.query.verification, {}, '$ne must be stripped');
  assert.deepEqual(req.query.status, {}, '$gt must be stripped');
  assert.deepEqual(req.query.action, {}, '$regex must be stripped');
  assert.equal(req.query.q, 'harmless', 'ordinary values must survive');
});

test('sanitizer strips dotted keys that could reach nested paths', () => {
  const req = { query: {}, body: { 'verification.emailVerified': true, name: 'ok' }, params: {} };
  mongoSanitize()(req, {}, () => {});

  assert.equal(
    req.body['verification.emailVerified'],
    undefined,
    'dotted path must not survive into a document write'
  );
  assert.equal(req.body.name, 'ok');
});

test('whitelists reject an operator object even if the sanitizer is bypassed', () => {
  // Second layer: services test membership, so a non-primitive can never
  // become a filter value regardless of what reached them.
  const hostile = { $ne: 'verified' };

  assert.equal(VERIFICATION_STATUS.includes(hostile), false);
  assert.equal(REPORT_STATUS.includes(hostile), false);
  assert.equal(USER_ROLES.includes(hostile), false);

  // And the legitimate values still pass.
  assert.equal(VERIFICATION_STATUS.includes('verified'), true);
  assert.equal(REPORT_STATUS.includes('open'), true);
  assert.equal(USER_ROLES.includes('admin'), true);
});

test('the removed volunteer role is not accepted by any role whitelist', () => {
  assert.equal(USER_ROLES.includes('volunteer'), false);
});
