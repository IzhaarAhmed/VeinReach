import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgesForDonationCount } from '../src/services/reputation.service.js';

test('no badges before the first donation', () => {
  assert.deepEqual(badgesForDonationCount(0), []);
});

test('first donation awards first_donation', () => {
  assert.deepEqual(badgesForDonationCount(1), ['first_donation']);
});

test('badges accumulate at thresholds', () => {
  assert.deepEqual(badgesForDonationCount(5), ['first_donation', 'lifesaver']);
  assert.deepEqual(badgesForDonationCount(25), [
    'first_donation',
    'lifesaver',
    'hero_donor',
  ]);
  assert.deepEqual(badgesForDonationCount(50), [
    'first_donation',
    'lifesaver',
    'hero_donor',
    'community_champion',
  ]);
});
