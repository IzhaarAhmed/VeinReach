import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyOtpSchema } from '../src/validators/auth.schema.js';
import { presignSchema } from '../src/validators/upload.schema.js';

test('OTP schema accepts a 6-digit string code', () => {
  const r = verifyOtpSchema.safeParse({ code: '123456' });
  assert.ok(r.success);
  assert.equal(r.data.code, '123456');
});

test('OTP schema coerces a numeric code to a string', () => {
  const r = verifyOtpSchema.safeParse({ code: 123456 });
  assert.ok(r.success);
  assert.equal(r.data.code, '123456');
});

test('OTP schema rejects non-numeric or wrong-length codes', () => {
  assert.equal(verifyOtpSchema.safeParse({ code: 'abcdef' }).success, false);
  assert.equal(verifyOtpSchema.safeParse({ code: '12' }).success, false);
  assert.equal(verifyOtpSchema.safeParse({ code: '123456789' }).success, false);
});

test('presign schema rejects unknown purposes', () => {
  assert.equal(
    presignSchema.safeParse({ purpose: 'app_data', contentType: 'image/png' }).success,
    false
  );
});

test('presign schema accepts a known purpose', () => {
  const r = presignSchema.safeParse({ purpose: 'profile_image', contentType: 'image/png' });
  assert.ok(r.success);
});
