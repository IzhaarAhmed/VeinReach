import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateEligibility,
  cooldownRemainingDays,
  ageFromDOB,
} from '../src/services/eligibility.service.js';

const yearsAgo = (n) => {
  const d = new Date('2026-01-01T00:00:00Z');
  d.setFullYear(d.getFullYear() - n);
  return d;
};
const NOW = new Date('2026-01-01T00:00:00Z');

test('ageFromDOB computes whole years', () => {
  assert.equal(ageFromDOB(yearsAgo(25), NOW), 25);
});

test('eligible healthy adult donor', () => {
  const r = evaluateEligibility(
    {
      dateOfBirth: yearsAgo(30),
      weight: 70,
      gender: 'male',
      lastDonationDate: null,
      isAvailable: true,
      isSuspended: false,
      status: 'available',
    },
    NOW
  );
  assert.equal(r.eligible, true);
  assert.deepEqual(r.reasons, []);
});

test('underage donor is ineligible', () => {
  const r = evaluateEligibility(
    { dateOfBirth: yearsAgo(16), weight: 70, gender: 'male', isAvailable: true },
    NOW
  );
  assert.ok(r.reasons.includes('under_minimum_age'));
});

test('underweight donor is ineligible', () => {
  const r = evaluateEligibility(
    { dateOfBirth: yearsAgo(30), weight: 45, gender: 'female', isAvailable: true },
    NOW
  );
  assert.ok(r.reasons.includes('under_weight_requirement'));
});

test('male cooldown is 90 days', () => {
  const last = new Date('2025-12-01T00:00:00Z'); // 31 days before NOW
  assert.equal(cooldownRemainingDays(last, 'male', NOW), 90 - 31);
});

test('female cooldown is 120 days', () => {
  const last = new Date('2025-12-01T00:00:00Z');
  assert.equal(cooldownRemainingDays(last, 'female', NOW), 120 - 31);
});

test('donor in cooldown is ineligible', () => {
  const r = evaluateEligibility(
    {
      dateOfBirth: yearsAgo(30),
      weight: 70,
      gender: 'male',
      lastDonationDate: new Date('2025-12-15T00:00:00Z'),
      isAvailable: true,
    },
    NOW
  );
  assert.ok(r.reasons.includes('cooldown_active'));
});
