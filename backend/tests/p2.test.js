import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReportSchema, resolveReportSchema } from '../src/validators/report.schema.js';
import { publishShortageSchema, nearbyStockSchema } from '../src/validators/stock.schema.js';
import { reviewOrgSchema, suspendSchema } from '../src/validators/admin.schema.js';
import { Report } from '../src/models/report.model.js';
import { BloodStock } from '../src/models/stock.model.js';

test('user report requires a targetUserId', () => {
  assert.equal(
    createReportSchema.safeParse({ targetType: 'user', category: 'spam' }).success,
    false
  );
  assert.equal(
    createReportSchema.safeParse({ targetType: 'user', targetUserId: 'u1', category: 'spam' })
      .success,
    true
  );
});

test('request report requires a targetRequestId', () => {
  assert.equal(
    createReportSchema.safeParse({ targetType: 'request', category: 'fake_request' }).success,
    false
  );
  assert.ok(
    createReportSchema.safeParse({
      targetType: 'request',
      targetRequestId: 'r1',
      category: 'fake_request',
    }).success
  );
});

test('report resolution only accepts terminal statuses', () => {
  assert.ok(resolveReportSchema.safeParse({ status: 'resolved', action: 'suspend' }).success);
  assert.ok(resolveReportSchema.safeParse({ status: 'dismissed' }).success);
  assert.equal(resolveReportSchema.safeParse({ status: 'open' }).success, false);
  assert.equal(resolveReportSchema.safeParse({ status: 'reviewing' }).success, false);
});

test('publish shortage rejects a non-shortage level', () => {
  assert.ok(publishShortageSchema.safeParse({ bloodGroup: 'O-', level: 'critical' }).success);
  // 'available' is availability, not a shortage — not allowed on this endpoint.
  assert.equal(publishShortageSchema.safeParse({ bloodGroup: 'O-', level: 'available' }).success, false);
});

test('nearby stock coerces query strings and booleans', () => {
  const r = nearbyStockSchema.safeParse({ lng: '77.5', lat: '12.9', shortagesOnly: 'true' });
  assert.ok(r.success);
  assert.equal(r.data.lng, 77.5);
  assert.equal(r.data.shortagesOnly, true);
});

test('admin schemas validate decisions + suspension', () => {
  assert.ok(reviewOrgSchema.safeParse({ decision: 'approve' }).success);
  assert.equal(reviewOrgSchema.safeParse({ decision: 'maybe' }).success, false);
  assert.ok(suspendSchema.safeParse({ suspend: true, reason: 'spam' }).success);
  assert.equal(suspendSchema.safeParse({ suspend: 'yes' }).success, false);
});

test('Report + BloodStock models instantiate with valid defaults', () => {
  const report = new Report({
    reporter: '64b0f1a2c3d4e5f6a7b8c9d0',
    targetType: 'user',
    targetUser: '64b0f1a2c3d4e5f6a7b8c9d1',
    category: 'spam',
  });
  assert.equal(report.status, 'open');
  assert.equal(report.action, 'none');

  const stock = new BloodStock({ owner: '64b0f1a2c3d4e5f6a7b8c9d0' });
  stock.inventory.push({ bloodGroup: 'O+', units: 3 });
  assert.equal(stock.inventory[0].level, 'available');
});
