import * as donorRepo from '../repositories/donor.repository.js';
import { compatibleDonorGroups, matchRank } from './compatibility.service.js';
import { evaluateEligibility } from './eligibility.service.js';
import { SEARCH_RADII_KM } from '../constants/index.js';

/**
 * Smart Location Matching: find compatible, eligible donors near a point and
 * sort them by the spec priority — compatibility → distance → reputation.
 */
export async function searchDonors({ bloodGroup, lng, lat, radiusKm = 10, limit = 100 }) {
  const groups = compatibleDonorGroups(bloodGroup);

  const raw = await donorRepo.findNearbyDonors({
    coordinates: [lng, lat],
    groups,
    maxDistanceMeters: radiusKm * 1000,
    limit,
  });

  const enriched = raw.map((d) => {
    const eligibility = evaluateEligibility({
      dateOfBirth: d.dateOfBirth,
      weight: d.weight,
      gender: d.gender,
      lastDonationDate: d.donorProfile?.lastDonationDate,
      isAvailable: true,
      isSuspended: false,
      status: d.donorProfile?.status,
    });

    return {
      id: d._id,
      fullName: d.fullName,
      bloodGroup: d.bloodGroup,
      city: d.city,
      state: d.state,
      distanceKm: Math.round((d.distanceMeters / 1000) * 10) / 10,
      reputationScore: d.donorProfile?.reputationScore ?? 0,
      donationCount: d.donorProfile?.donationCount ?? 0,
      status: d.donorProfile?.status,
      eligible: eligibility.eligible,
      eligibilityReasons: eligibility.reasons,
      _rank: matchRank(d.bloodGroup, bloodGroup),
    };
  });

  enriched.sort((a, b) => {
    if (a._rank !== b._rank) return a._rank - b._rank; // 1. compatibility (exact first)
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm; // 2. distance
    return b.reputationScore - a.reputationScore; // 3. reputation
  });

  // eslint-disable-next-line no-unused-vars
  return enriched.map(({ _rank, ...rest }) => rest);
}

/** Donor Radar: counts of available compatible donors per distance ring. */
export async function radar({ bloodGroup, lng, lat, radiiKm = SEARCH_RADII_KM }) {
  const groups = compatibleDonorGroups(bloodGroup);
  const rings = await donorRepo.countByRadius({
    coordinates: [lng, lat],
    groups,
    radiiKm,
  });
  return { bloodGroup, rings };
}
