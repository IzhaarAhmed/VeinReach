import { BLOOD_GROUPS } from '../constants/index.js';

/**
 * Blood Compatibility Engine.
 *
 * Maps each recipient blood group to the donor groups it can SAFELY receive
 * red blood cells from. This is the canonical RBC compatibility matrix.
 *
 *   Recipient  ← can receive from
 *   O-         ← O-
 *   O+         ← O-, O+
 *   A-         ← O-, A-
 *   A+         ← O-, O+, A-, A+
 *   B-         ← O-, B-
 *   B+         ← O-, O+, B-, B+
 *   AB-        ← O-, A-, B-, AB-
 *   AB+        ← everyone (universal recipient)
 */
const RECIPIENT_CAN_RECEIVE_FROM = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
};

/** Donor groups (inclusive) that can give RBCs to the given recipient group. */
export function compatibleDonorGroups(recipientGroup) {
  const list = RECIPIENT_CAN_RECEIVE_FROM[recipientGroup];
  if (!list) {
    throw new Error(`Unknown blood group: ${recipientGroup}`);
  }
  return [...list];
}

/** True if a donor of donorGroup can donate RBCs to a recipient of recipientGroup. */
export function isCompatible(donorGroup, recipientGroup) {
  return compatibleDonorGroups(recipientGroup).includes(donorGroup);
}

/** True if donor and recipient blood groups are identical. */
export function isExactMatch(donorGroup, recipientGroup) {
  return donorGroup === recipientGroup;
}

/**
 * Match quality used for sorting (spec priority: exact match first, then
 * compatible). Lower rank = better. Incompatible donors get Infinity so
 * callers can filter them out.
 */
export function matchRank(donorGroup, recipientGroup) {
  if (isExactMatch(donorGroup, recipientGroup)) return 0;
  if (isCompatible(donorGroup, recipientGroup)) return 1;
  return Infinity;
}

/** Recipient groups that the given donor group can help (for "marketplace" reach). */
export function recipientsHelpedBy(donorGroup) {
  return BLOOD_GROUPS.filter((rg) => isCompatible(donorGroup, rg));
}
