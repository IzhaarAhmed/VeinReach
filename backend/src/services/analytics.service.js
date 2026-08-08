import { User } from '../models/user.model.js';
import { BloodRequest } from '../models/request.model.js';
import { Donation } from '../models/donation.model.js';

const countByField = async (Model, field, match = {}) => {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r) => ({ key: r._id, count: r.count }));
};

/** Average minutes from request creation to its first donor acceptance. */
async function avgFirstResponseMinutes(match = {}) {
  const rows = await BloodRequest.aggregate([
    { $match: { ...match, 'acceptedDonors.0': { $exists: true } } },
    {
      $project: {
        deltaMs: {
          $subtract: [{ $min: '$acceptedDonors.acceptedAt' }, '$createdAt'],
        },
      },
    },
    { $group: { _id: null, avgMs: { $avg: '$deltaMs' } } },
  ]);
  const avgMs = rows[0]?.avgMs;
  return avgMs ? Math.round(avgMs / 60000) : null;
}

/** Fulfillment rate over settled requests (fulfilled ÷ fulfilled+expired). */
function fulfillmentRate(byStatus) {
  const map = Object.fromEntries(byStatus.map((r) => [r.key, r.count]));
  const fulfilled = map.fulfilled || 0;
  const settled = fulfilled + (map.expired || 0) + (map.cancelled || 0);
  return settled ? Math.round((fulfilled / settled) * 1000) / 10 : null; // percent, 1dp
}

/**
 * Platform-wide analytics (spec: Analytics Dashboard). A single aggregation
 * bundle so the admin dashboard is one round trip.
 */
export async function platformStats() {
  const [
    totalUsers,
    usersByRole,
    requestsByStatus,
    requestsByBloodGroup,
    activeRequests,
    verifiedDonations,
    availableDonors,
    avgResponseMin,
  ] = await Promise.all([
    // Closed accounts are kept as tombstones, so an unfiltered count would keep
    // reporting people who have left as platform users.
    User.countDocuments({ deletedAt: null }),
    // Same exclusion as totalUsers, so the per-role breakdown still sums to it.
    countByField(User, 'role', { deletedAt: null }),
    countByField(BloodRequest, 'status'),
    countByField(BloodRequest, 'bloodGroup'),
    BloodRequest.countDocuments({ status: 'active' }),
    Donation.countDocuments({ status: 'verified' }),
    User.countDocuments({
      role: 'donor',
      'donorProfile.isAvailable': true,
      isSuspended: false,
      deletedAt: null,
    }),
    avgFirstResponseMinutes(),
  ]);

  return {
    users: { total: totalUsers, byRole: usersByRole, availableDonors },
    requests: {
      active: activeRequests,
      byStatus: requestsByStatus,
      fulfillmentRatePct: fulfillmentRate(requestsByStatus),
      mostNeededBloodGroups: requestsByBloodGroup.slice(0, 8),
    },
    donations: { verified: verifiedDonations },
    responsiveness: { avgFirstResponseMinutes: avgResponseMin },
  };
}

/** Daily counts of documents matching `match`, bucketed by `dateField`. */
async function seriesByDay(Model, dateField, since, match = {}) {
  const rows = await Model.aggregate([
    { $match: { [dateField]: { $gte: since }, ...match } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ date: r._id, count: r.count }));
}

/**
 * Time-series trends for the analytics dashboard (spec: Donor Growth, donation
 * & request trends). Daily buckets over the last N days (7–90, default 30).
 */
export async function trends({ days = 30 } = {}) {
  const n = Math.min(Math.max(Number(days) || 30, 7), 90);
  const since = new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  const [newUsers, newRequests, verifiedDonations] = await Promise.all([
    seriesByDay(User, 'createdAt', since),
    seriesByDay(BloodRequest, 'createdAt', since),
    seriesByDay(Donation, 'verifiedAt', since, { status: 'verified' }),
  ]);

  return { sinceDays: n, newUsers, newRequests, verifiedDonations };
}

/**
 * Stats scoped to one hospital account: the requests it created and the
 * donations it verified (spec: Hospital Portal — analytics).
 */
export async function hospitalStats(hospitalId) {
  const [requestsByStatus, requestsByBloodGroup, verifiedByHospital, avgResponseMin] =
    await Promise.all([
      countByField(BloodRequest, 'status', { createdBy: hospitalId }),
      countByField(BloodRequest, 'bloodGroup', { createdBy: hospitalId }),
      Donation.countDocuments({ verifiedBy: hospitalId, status: 'verified' }),
      avgFirstResponseMinutes({ createdBy: hospitalId }),
    ]);

  const totalRequests = requestsByStatus.reduce((s, r) => s + r.count, 0);
  return {
    requests: {
      total: totalRequests,
      byStatus: requestsByStatus,
      fulfillmentRatePct: fulfillmentRate(requestsByStatus),
      byBloodGroup: requestsByBloodGroup,
    },
    donationsVerified: verifiedByHospital,
    responsiveness: { avgFirstResponseMinutes: avgResponseMin },
  };
}
