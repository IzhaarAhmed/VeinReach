import { env } from '../config/env.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function ageFromDOB(dob, now = new Date()) {
  if (!dob) return null;
  const birth = new Date(dob);
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function cooldownDaysFor(gender) {
  return gender === 'female'
    ? env.rules.cooldownDaysFemale
    : env.rules.cooldownDaysMale;
}

/**
 * Days remaining before the donor exits cooldown. 0 means eligible now.
 */
export function cooldownRemainingDays(lastDonationDate, gender, now = new Date()) {
  if (!lastDonationDate) return 0;
  const cooldown = cooldownDaysFor(gender);
  const elapsedDays = Math.floor((now - new Date(lastDonationDate)) / MS_PER_DAY);
  return Math.max(0, cooldown - elapsedDays);
}

export function nextEligibleDate(lastDonationDate, gender) {
  if (!lastDonationDate) return null;
  const next = new Date(lastDonationDate);
  next.setDate(next.getDate() + cooldownDaysFor(gender));
  return next;
}

/**
 * Donor Eligibility Validation (spec).
 *
 * Returns { eligible, reasons[], details } — a donor cannot accept a request if
 * under min age, over max age, under weight, marked unavailable, suspended, or
 * still in donation cooldown. Pure function: no DB access, easy to unit test.
 *
 * @param {object} donor  { dateOfBirth, weight, gender, lastDonationDate,
 *                          isAvailable, isSuspended, status }
 */
export function evaluateEligibility(donor, now = new Date()) {
  const reasons = [];
  const { minDonorAge, maxDonorAge, minDonorWeight } = env.rules;

  const age = ageFromDOB(donor.dateOfBirth, now);
  if (age == null) {
    reasons.push('missing_date_of_birth');
  } else {
    if (age < minDonorAge) reasons.push('under_minimum_age');
    if (age > maxDonorAge) reasons.push('over_maximum_age');
  }

  if (donor.weight == null) {
    reasons.push('missing_weight');
  } else if (donor.weight < minDonorWeight) {
    reasons.push('under_weight_requirement');
  }

  if (donor.isSuspended) reasons.push('suspended');
  if (donor.isAvailable === false || donor.status === 'offline')
    reasons.push('marked_unavailable');

  const cooldownLeft = cooldownRemainingDays(
    donor.lastDonationDate,
    donor.gender,
    now
  );
  if (cooldownLeft > 0) reasons.push('cooldown_active');

  return {
    eligible: reasons.length === 0,
    reasons,
    details: {
      age,
      cooldownRemainingDays: cooldownLeft,
      nextEligibleDate: nextEligibleDate(donor.lastDonationDate, donor.gender),
    },
  };
}
