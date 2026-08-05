import { User } from '../models/user.model.js';

/**
 * Find donors near a point whose blood group is in `groups`, using a MongoDB
 * geospatial $geoNear aggregation. Returns each donor with a computed
 * `distanceMeters`. Only available, non-suspended donors are considered.
 *
 * @param {object} opts
 * @param {[number,number]} opts.coordinates  [lng, lat]
 * @param {string[]} opts.groups              compatible blood groups
 * @param {number} opts.maxDistanceMeters
 * @param {number} opts.limit
 */
export function findNearbyDonors({ coordinates, groups, maxDistanceMeters, limit = 100 }) {
  return User.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates },
        distanceField: 'distanceMeters',
        maxDistance: maxDistanceMeters,
        spherical: true,
        query: {
          role: 'donor',
          isSuspended: false,
          bloodGroup: { $in: groups },
          'donorProfile.isAvailable': true,
        },
      },
    },
    { $limit: limit },
    {
      // Never expose exact coordinates or sensitive fields (spec: privacy).
      $project: {
        fullName: 1,
        bloodGroup: 1,
        city: 1,
        state: 1,
        distanceMeters: 1,
        'donorProfile.status': 1,
        'donorProfile.reputationScore': 1,
        'donorProfile.donationCount': 1,
        'donorProfile.lastDonationDate': 1,
        'donorProfile.preferredRadiusKm': 1,
        dateOfBirth: 1,
        weight: 1,
        gender: 1,
      },
    },
  ]);
}

/**
 * Count available compatible donors grouped by distance ring (for the
 * real-time Donor Radar). Returns [{ radiusKm, count }].
 */
export async function countByRadius({ coordinates, groups, radiiKm }) {
  const maxKm = Math.max(...radiiKm);
  const donors = await User.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates },
        distanceField: 'distanceMeters',
        maxDistance: maxKm * 1000,
        spherical: true,
        query: {
          role: 'donor',
          isSuspended: false,
          bloodGroup: { $in: groups },
          'donorProfile.isAvailable': true,
        },
      },
    },
    { $project: { distanceMeters: 1 } },
  ]);

  return radiiKm
    .slice()
    .sort((a, b) => a - b)
    .map((radiusKm) => ({
      radiusKm,
      count: donors.filter((d) => d.distanceMeters <= radiusKm * 1000).length,
    }));
}
