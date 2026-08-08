import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { User } from '../src/models/user.model.js';
import { anonymizeUserDoc, describeAsset } from '../src/services/privacy.service.js';
import { deleteAccountSchema } from '../src/validators/user.schema.js';
import { registerSchema } from '../src/validators/auth.schema.js';
import { ANONYMIZED, PRIVACY_POLICY_VERSION } from '../src/constants/index.js';

/**
 * Erasure and consent. Mongoose documents can be constructed and serialized
 * without a connection, so the anonymization invariant is testable here —
 * `npm test` still needs no database.
 */

/** A user with every personal field populated, so nothing can hide. */
const PII = {
  fullName: 'Asha Menon',
  email: 'asha.menon@example.com',
  mobile: '+919812345678',
  bloodGroup: 'O-',
  gender: 'female',
  dateOfBirth: new Date('1994-03-17'),
  weight: 61,
  city: 'Kochi',
  state: 'Kerala',
  emergencyContact: '+919887766554',
};

function makeUser() {
  const user = new User({
    ...PII,
    role: 'donor',
    location: { type: 'Point', coordinates: [76.2673, 9.9312] },
    donorProfile: { isAvailable: true, status: 'available', donationCount: 4, badges: ['lifesaver'] },
    avatar: { key: 'profile_image/abc/1.jpg', url: 'https://cdn.example/1.jpg' },
    documents: [{ key: 'verification_doc/abc/id.pdf', docType: 'id', label: 'Aadhaar' }],
  });
  user.passwordHash = '$2a$12$notarealhashbutlongenoughtolooklikeone000000000000000';
  user.refreshTokens = ['hash-a', 'hash-b'];
  user.fcmTokens = ['device-token-1'];
  return user;
}

test('anonymizing leaves no personal value anywhere in the document', () => {
  const user = makeUser();
  anonymizeUserDoc(user);

  // Serialize everything the document still holds, including select:false paths
  // that toJSON would hide — those are exactly where a leak would survive.
  const dump = JSON.stringify(user.toObject());

  const survivors = Object.entries(PII)
    .filter(([field]) => field !== 'bloodGroup') // retained by design, see below
    .filter(([, value]) => {
      const needle = value instanceof Date ? value.toISOString() : String(value);
      return dump.includes(needle);
    })
    .map(([field]) => field);

  assert.deepEqual(survivors, [], `these personal fields survived anonymization: ${survivors}`);
});

test('anonymizing removes the exact location, files and every credential', () => {
  const user = makeUser();
  anonymizeUserDoc(user);

  assert.equal(user.location, undefined, 'coordinates must not survive');
  assert.equal(user.avatar, undefined, 'avatar must not survive');
  assert.deepEqual(user.documents.length, 0, 'documents must not survive');
  assert.deepEqual(user.refreshTokens, [], 'sessions must be revoked');
  assert.deepEqual(user.fcmTokens, [], 'push devices must be detached');
  assert.equal(user.verification.emailVerified, false);
  assert.equal(user.verification.mobileVerified, false);
});

test('a tombstone is marked deleted and cannot surface as an available donor', () => {
  const user = makeUser();
  anonymizeUserDoc(user);

  assert.ok(user.deletedAt instanceof Date, 'deletedAt must be stamped');
  assert.equal(user.donorProfile.isAvailable, false);
  assert.equal(user.donorProfile.status, 'offline');
  assert.deepEqual(user.donorProfile.badges, []);
});

test('the ledger-bearing fields are deliberately kept', () => {
  const user = makeUser();
  anonymizeUserDoc(user);

  // Neither is linkable to a person once the identifiers are gone, and the
  // donation ledger already implies both.
  assert.equal(user.bloodGroup, 'O-');
  assert.equal(user.donorProfile.donationCount, 4);
});

test('the tombstone email is unique, reserved, and still schema-valid', () => {
  const a = makeUser();
  const b = makeUser();
  anonymizeUserDoc(a);
  anonymizeUserDoc(b);

  // `email` carries a unique index and is required, so anonymizing cannot unset
  // it — two closed accounts must not collide on the same placeholder.
  assert.notEqual(a.email, b.email);
  // RFC 2606 reserves .invalid, so this can never be a deliverable address.
  assert.match(a.email, /@deleted\.invalid$/);
  assert.equal(a.validateSync(), undefined, 'a tombstone must still satisfy the schema');
});

test('an anonymized document has no validation gaps on required fields', () => {
  const user = makeUser();
  anonymizeUserDoc(user);
  const err = user.validateSync();
  assert.equal(err, undefined, err && `required fields broke: ${Object.keys(err.errors)}`);
});

test('exported file descriptions never include the storage key', () => {
  const described = describeAsset({
    key: 'verification_doc/abc/secret.pdf',
    url: 'https://cdn.example/secret.pdf',
    name: 'passport.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
  });

  // A key is a capability: anything holding one can be presigned a download, so
  // it must not travel inside an export file.
  assert.equal('key' in described, false, 'the R2 key must not be exported');
  assert.equal('url' in described, false, 'a direct URL must not be exported');
  assert.equal(described.name, 'passport.pdf');
  assert.equal(described.sizeBytes, 1024);
});

test('describeAsset tolerates a missing asset', () => {
  assert.equal(describeAsset(undefined), undefined);
  assert.equal(describeAsset(null), null);
});

/* ── Consent + confirmation ─────────────────────────────────────────────── */

const validRegistration = {
  fullName: 'Asha Menon',
  email: 'asha@example.com',
  mobile: '+919812345678',
  password: 'correct horse battery',
  bloodGroup: 'O-',
  gender: 'female',
  dateOfBirth: '1994-03-17',
  weight: 61,
  acceptPrivacy: true,
};

test('registration requires privacy consent', () => {
  assert.equal(registerSchema.safeParse(validRegistration).success, true);

  const { acceptPrivacy: _omitted, ...withoutConsent } = validRegistration;
  assert.equal(
    registerSchema.safeParse(withoutConsent).success,
    false,
    'consent must not be optional'
  );
});

test('privacy consent must be an affirmative true, not merely truthy', () => {
  for (const value of [false, 'true', 1, null]) {
    assert.equal(
      registerSchema.safeParse({ ...validRegistration, acceptPrivacy: value }).success,
      false,
      `acceptPrivacy=${JSON.stringify(value)} must be rejected`
    );
  }
});

test('closing an account needs both the password and the exact phrase', () => {
  assert.equal(deleteAccountSchema.safeParse({ password: 'pw', confirm: 'DELETE' }).success, true);
  assert.equal(deleteAccountSchema.safeParse({ password: 'pw' }).success, false);
  assert.equal(deleteAccountSchema.safeParse({ confirm: 'DELETE' }).success, false);
  // Not case-insensitive, and not "delete my account" — a bare or fuzzy
  // confirmation must never erase a donation history.
  assert.equal(deleteAccountSchema.safeParse({ password: 'pw', confirm: 'delete' }).success, false);
  assert.equal(deleteAccountSchema.safeParse({ password: 'pw', confirm: '' }).success, false);
});

/* ── Policy version consistency ─────────────────────────────────────────── */

test('the recorded consent version matches the published policy text', () => {
  // The policy the user actually reads lives in the SPA; this constant is what
  // gets stored on the account. If they drift, every consent record points at a
  // version of the text that was never shown.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const policyPath = path.resolve(here, '../../frontend/src/content/privacyPolicy.js');

  if (!fs.existsSync(policyPath)) {
    // Backend checked out on its own — nothing to compare against.
    assert.match(PRIVACY_POLICY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
    return;
  }

  const source = fs.readFileSync(policyPath, 'utf8');
  const match = source.match(/version:\s*'([^']+)'/);
  assert.ok(match, 'could not find `version:` in the frontend policy module');
  assert.equal(
    match[1],
    PRIVACY_POLICY_VERSION,
    'PRIVACY_POLICY_VERSION and the frontend policy version must be bumped together'
  );
});

test('the anonymization sentinels are obviously not real data', () => {
  assert.equal(ANONYMIZED.dateOfBirth.getTime(), 0);
  assert.equal(ANONYMIZED.weight, 0);
  assert.match(ANONYMIZED.emailFor('abc123'), /^deleted-abc123@deleted\.invalid$/);
});
