/** Reputation deltas (spec: Reputation System — increase/decrease events). */
export const POINTS_VERIFIED_DONATION = 10;
export const POINTS_POSITIVE_FEEDBACK = 3; // rating >= 4
export const PENALTY_NEGATIVE_FEEDBACK = -3; // rating <= 2
export const PENALTY_NO_SHOW = -15;
export const PENALTY_MODERATION = -25; // admin-applied penalty on a upheld report

/** Reputation delta implied by a 1–5 feedback rating (0 for a neutral 3). */
export function feedbackDelta(rating) {
  if (rating >= 4) return POINTS_POSITIVE_FEEDBACK;
  if (rating <= 2) return PENALTY_NEGATIVE_FEEDBACK;
  return 0;
}

/** Reputation never goes negative — clamp at zero. */
export function clampScore(score) {
  return Math.max(0, score);
}

/** Badge slugs by cumulative donation count (spec: Badges). */
export const BADGE_THRESHOLDS = [
  { badge: 'first_donation', count: 1 },
  { badge: 'lifesaver', count: 5 },
  { badge: 'hero_donor', count: 25 },
  { badge: 'community_champion', count: 50 },
];

/** All badges a donor has earned at a given donation count. Pure. */
export function badgesForDonationCount(count) {
  return BADGE_THRESHOLDS.filter((t) => count >= t.count).map((t) => t.badge);
}
