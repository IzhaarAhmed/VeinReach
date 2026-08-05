import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  forgotPasswordSchema,
  verifyResetOtpSchema,
  resetPasswordSchema,
  registerSchema,
} from '../src/validators/auth.schema.js';

test('forgot-password requires a well-formed email', () => {
  assert.ok(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success);
  assert.equal(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success, false);
  assert.equal(forgotPasswordSchema.safeParse({}).success, false);
});

test('verify-reset-otp accepts a 6-digit code and coerces numbers', () => {
  const asString = verifyResetOtpSchema.safeParse({ email: 'a@b.co', code: '123456' });
  assert.ok(asString.success);
  assert.equal(asString.data.code, '123456');

  const asNumber = verifyResetOtpSchema.safeParse({ email: 'a@b.co', code: 123456 });
  assert.ok(asNumber.success);
  assert.equal(asNumber.data.code, '123456');
});

test('verify-reset-otp rejects malformed codes', () => {
  const bad = ['abcdef', '12', '123456789', ''];
  for (const code of bad) {
    assert.equal(
      verifyResetOtpSchema.safeParse({ email: 'a@b.co', code }).success,
      false,
      `expected ${JSON.stringify(code)} to be rejected`
    );
  }
});

test('reset-password requires email, ticket and password together', () => {
  const ticket = 'a'.repeat(64);
  assert.ok(
    resetPasswordSchema.safeParse({ email: 'a@b.co', ticket, password: 'longenough1' }).success
  );
  assert.equal(resetPasswordSchema.safeParse({ ticket, password: 'longenough1' }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ email: 'a@b.co', password: 'longenough1' }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ email: 'a@b.co', ticket }).success, false);
});

test('reset-password rejects a short or truncated ticket', () => {
  assert.equal(
    resetPasswordSchema.safeParse({ email: 'a@b.co', ticket: 'abc', password: 'longenough1' })
      .success,
    false
  );
});

test('a reset must not weaken the registration password policy', () => {
  const ticket = 'a'.repeat(64);
  const weak = 'short1';

  // Whatever the register schema refuses, the reset schema must refuse too.
  assert.equal(registerSchema.shape.password.safeParse(weak).success, false);
  assert.equal(
    resetPasswordSchema.safeParse({ email: 'a@b.co', ticket, password: weak }).success,
    false
  );

  // And both must agree on the minimum length.
  const boundary = 'a'.repeat(8);
  assert.equal(registerSchema.shape.password.safeParse(boundary).success, true);
  assert.equal(
    resetPasswordSchema.safeParse({ email: 'a@b.co', ticket, password: boundary }).success,
    true
  );
});
