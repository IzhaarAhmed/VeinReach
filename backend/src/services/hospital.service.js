import { Donation } from '../models/donation.model.js';
import * as analytics from './analytics.service.js';
import { paginate, pageMeta } from '../utils/pagination.js';

/** Donations this hospital verified, newest first, paginated. */
export async function verifiedDonations(hospitalId, query = {}) {
  const { page, limit, skip } = paginate(query);
  const filter = { verifiedBy: hospitalId };
  const [donations, total] = await Promise.all([
    Donation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('donor', 'fullName bloodGroup')
      .populate('recipient', 'fullName'),
    Donation.countDocuments(filter),
  ]);
  return { donations, meta: pageMeta({ page, limit, total }) };
}

/** Hospital-scoped analytics (spec: Hospital Portal — access analytics). */
export const stats = (hospitalId) => analytics.hospitalStats(hospitalId);
