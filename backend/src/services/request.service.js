import * as requestRepo from '../repositories/request.repository.js';
import * as donorRepo from '../repositories/donor.repository.js';
import * as donationRepo from '../repositories/donation.repository.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { evaluateEligibility } from './eligibility.service.js';
import { isCompatible, compatibleDonorGroups } from './compatibility.service.js';
import {
  POINTS_VERIFIED_DONATION,
  PENALTY_NO_SHOW,
  badgesForDonationCount,
  clampScore,
} from './reputation.service.js';
import { notifyUser } from './notification.service.js';
import { issueCertificate } from './certificate.service.js';
import { ESCALATION_LADDER_KM } from '../constants/index.js';
import { env } from '../config/env.js';
import { getIO } from '../realtime/io.js';
import { logger } from '../utils/logger.js';

const URGENCY_TTL_HOURS = { critical: 6, urgent: 24, normal: 72 };

/** Id of a ref field that may or may not be populated. */
const idOf = (v) => String(v?._id ?? v);

/** Personal rooms of everyone involved in a request (creator + accepted donors). */
function participantRooms(request) {
  const rooms = new Set([`user:${idOf(request.createdBy)}`]);
  for (const a of request.acceptedDonors) rooms.add(`user:${idOf(a.donor)}`);
  return [...rooms];
}

/** Push a request:update only to the people who are part of the request. */
function emitRequestUpdate(request, extra = {}) {
  getIO()
    ?.to(participantRooms(request))
    .emit('request:update', {
      id: request._id,
      status: request.status,
      acceptedCount: request.acceptedDonors.length,
      ...extra,
    });
}

/**
 * Notify compatible, available donors near the hospital — each on their
 * personal room, never a global broadcast. Donors outside their preferred
 * radius are skipped unless the request is critical (spec: emergency
 * broadcast overrides, normal matching respects donor preference).
 *
 * Channels: socket + in-app + push always; email only for urgent/critical
 * so normal requests don't mass-mail every nearby donor.
 *
 * `minDistanceMeters` limits notification to the annulus outside a previous
 * radius — used by escalation so already-notified donors aren't pinged twice.
 */
export async function notifyNearbyDonors(request, { minDistanceMeters = 0 } = {}) {
  const io = getIO();

  const donors = await donorRepo.findNearbyDonors({
    coordinates: request.hospitalLocation.coordinates,
    groups: compatibleDonorGroups(request.bloodGroup),
    maxDistanceMeters: request.broadcastRadiusKm * 1000,
    limit: 500,
  });

  const emailToo = ['critical', 'urgent'].includes(request.urgency);
  const creatorId = idOf(request.createdBy);
  let notified = 0;

  for (const d of donors) {
    if (String(d._id) === creatorId) continue;
    if (d.distanceMeters < minDistanceMeters) continue;
    const preferredKm = d.donorProfile?.preferredRadiusKm ?? 10;
    if (request.urgency !== 'critical' && d.distanceMeters > preferredKm * 1000)
      continue;

    const distanceKm = Math.round(d.distanceMeters / 100) / 10;

    io?.to(`user:${d._id}`).emit('request:new', {
      id: request._id,
      bloodGroup: request.bloodGroup,
      urgency: request.urgency,
      hospitalName: request.hospitalName,
      coordinates: request.hospitalLocation.coordinates,
      distanceKm,
    });

    await notifyUser(d._id, {
      type: 'request_new',
      title:
        request.urgency === 'critical'
          ? `🚨 CRITICAL: ${request.bloodGroup} blood needed`
          : `🩸 ${request.bloodGroup} blood needed`,
      body: `${request.bloodGroup} blood is needed at ${request.hospitalName}, ~${distanceKm} km from you. Open VeinReach to accept.`,
      data: {
        requestId: request._id,
        bloodGroup: request.bloodGroup,
        urgency: request.urgency,
        hospitalName: request.hospitalName,
        distanceKm,
      },
      channels: emailToo ? ['inapp', 'email', 'push'] : ['inapp', 'push'],
    });
    notified += 1;
  }
  return notified;
}

export async function createRequest(userId, input) {
  const ttl = URGENCY_TTL_HOURS[input.urgency || 'normal'];
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);

  const request = await requestRepo.create({
    createdBy: userId,
    bloodGroup: input.bloodGroup,
    unitsRequired: input.unitsRequired,
    hospitalName: input.hospitalName,
    hospitalAddress: input.hospitalAddress,
    hospitalLocation: {
      type: 'Point',
      coordinates: input.hospitalLocation.coordinates,
    },
    urgency: input.urgency || 'normal',
    notes: input.notes,
    broadcastRadiusKm: env.rules.emergencyRadiusKm,
    expiresAt,
  });

  // Fire-and-forget: a notification failure must never fail request creation.
  notifyNearbyDonors(request).catch((err) =>
    logger.error('notifyNearbyDonors failed', err)
  );

  return request.toJSON();
}

export async function getRequest(id) {
  const request = await requestRepo.findById(id);
  if (!request) throw ApiError.notFound('Request not found');
  return request;
}

export async function listActive(filter = {}) {
  return requestRepo.list({ status: 'active', ...filter });
}

export async function myRequests(userId) {
  return requestRepo.findByCreator(userId);
}

/**
 * A donor accepts a request. Enforces donor role, compatibility + full
 * eligibility (age/weight/availability/suspension/cooldown) before allowing
 * acceptance.
 */
export async function acceptRequest(requestId, donorId) {
  const request = await requestRepo.findById(requestId);
  if (!request) throw ApiError.notFound('Request not found');
  if (!['active', 'accepted', 'in_progress'].includes(request.status))
    throw ApiError.badRequest(`Request is ${request.status}`);

  const donor = await User.findById(donorId);
  if (!donor) throw ApiError.notFound('Donor not found');
  if (donor.role !== 'donor')
    throw ApiError.forbidden('Only donor accounts can accept blood requests');
  if (idOf(request.createdBy) === String(donorId))
    throw ApiError.badRequest('You cannot accept your own request');

  if (!isCompatible(donor.bloodGroup, request.bloodGroup))
    throw ApiError.badRequest('Your blood group is not compatible with this request');

  const eligibility = evaluateEligibility({
    dateOfBirth: donor.dateOfBirth,
    weight: donor.weight,
    gender: donor.gender,
    lastDonationDate: donor.donorProfile?.lastDonationDate,
    isAvailable: donor.donorProfile?.isAvailable,
    isSuspended: donor.isSuspended,
    status: donor.donorProfile?.status,
  });
  if (!eligibility.eligible)
    throw new ApiError(403, 'Not eligible to donate', eligibility.reasons);

  const already = request.acceptedDonors.some((a) => idOf(a.donor) === String(donorId));
  if (already) throw ApiError.conflict('Already accepted this request');

  request.acceptedDonors.push({ donor: donorId });
  if (request.status === 'active') request.status = 'accepted';
  await requestRepo.save(request);

  emitRequestUpdate(request);

  return request.toJSON();
}

/**
 * Assert the caller may settle donations for this request. The request creator
 * always can; a hospital account can verify donations at its facility (spec:
 * hospitals are the verification authority). Returns the loaded request.
 */
function assertSettleAuthority(request, caller) {
  const isCreator = idOf(request.createdBy) === String(caller.id);
  const isHospital = caller.role === 'hospital';
  if (!isCreator && !isHospital)
    throw ApiError.forbidden('Only the request creator or a hospital can settle donations');
  return { isCreator, isHospital };
}

/**
 * Confirm a donor's donation actually happened. Closes the donation loop:
 * writes an immutable Donation record, stamps the donor's lastDonationDate
 * (starting cooldown), increments donationCount, awards reputation + badges,
 * and fulfills the request once enough units are verified.
 *
 * @param {object} caller { id, role } — request creator or a hospital account
 */
export async function completeDonation(requestId, caller, donorId) {
  const request = await requestRepo.findById(requestId);
  if (!request) throw ApiError.notFound('Request not found');
  const { isHospital } = assertSettleAuthority(request, caller);

  const entry = request.acceptedDonors.find((a) => idOf(a.donor) === String(donorId));
  if (!entry) throw ApiError.notFound('This donor has not accepted the request');
  if (entry.verified) throw ApiError.conflict('Donation already confirmed');

  entry.verified = true;
  const verifiedCount = request.acceptedDonors.filter((a) => a.verified).length;
  request.status = verifiedCount >= request.unitsRequired ? 'fulfilled' : 'in_progress';
  await requestRepo.save(request);

  const donation = await donationRepo.create({
    request: request._id,
    donor: donorId,
    recipient: idOf(request.createdBy),
    bloodGroup: request.bloodGroup,
    hospitalName: request.hospitalName,
    hospitalAddress: request.hospitalAddress,
    hospitalLocation: request.hospitalLocation,
    status: 'verified',
    verifiedBy: caller.id,
    verifiedByRole: caller.role,
    verifiedAt: new Date(),
  });

  // Fire-and-forget: generate + store the donation certificate. A storage
  // hiccup must never fail confirming the donation — it can be re-issued on demand.
  issueCertificate(donation).catch((err) => logger.error('certificate issue failed', err));

  const donor = await User.findById(donorId);
  if (donor) {
    donor.donorProfile.lastDonationDate = new Date();
    donor.donorProfile.donationCount += 1;
    donor.donorProfile.reputationScore = clampScore(
      donor.donorProfile.reputationScore + POINTS_VERIFIED_DONATION
    );
    donor.donorProfile.badges = [
      ...new Set([
        ...donor.donorProfile.badges,
        ...badgesForDonationCount(donor.donorProfile.donationCount),
      ]),
    ];
    await donor.save();

    const verifier = isHospital ? 'the hospital' : 'the recipient';
    getIO()?.to(`user:${donorId}`).emit('donation:confirmed', {
      requestId: request._id,
      donationId: donation._id,
      hospitalName: request.hospitalName,
      donationCount: donor.donorProfile.donationCount,
      badges: donor.donorProfile.badges,
      message: `Your donation at ${request.hospitalName} was confirmed by ${verifier}. Thank you for saving a life! ❤️`,
    });

    notifyUser(donorId, {
      type: 'donation_confirmed',
      title: '❤️ Donation confirmed',
      body: `Your donation at ${request.hospitalName} was confirmed. That's donation #${donor.donorProfile.donationCount} — thank you for saving a life!`,
      data: { requestId: request._id, donationId: donation._id, donationCount: donor.donorProfile.donationCount },
      channels: ['inapp', 'email', 'push'],
    }).catch((err) => logger.error('donation notification failed', err));
  }

  emitRequestUpdate(request, { verifiedCount });

  return { request: request.toJSON(), donation: donation.toJSON() };
}

/**
 * Mark an accepted donor as a no-show: records a no_show donation and applies
 * a reputation penalty (spec: decrease score on no-show behavior).
 */
export async function markNoShow(requestId, caller, donorId) {
  const request = await requestRepo.findById(requestId);
  if (!request) throw ApiError.notFound('Request not found');
  assertSettleAuthority(request, caller);

  const entry = request.acceptedDonors.find((a) => idOf(a.donor) === String(donorId));
  if (!entry) throw ApiError.notFound('This donor has not accepted the request');
  if (entry.verified) throw ApiError.conflict('Donation already verified — cannot mark no-show');

  // Drop the acceptance so the slot frees up and status can revert.
  request.acceptedDonors = request.acceptedDonors.filter(
    (a) => idOf(a.donor) !== String(donorId)
  );
  if (request.status === 'accepted' && request.acceptedDonors.length === 0)
    request.status = 'active';
  await requestRepo.save(request);

  const donation = await donationRepo.create({
    request: request._id,
    donor: donorId,
    recipient: idOf(request.createdBy),
    bloodGroup: request.bloodGroup,
    hospitalName: request.hospitalName,
    hospitalAddress: request.hospitalAddress,
    hospitalLocation: request.hospitalLocation,
    status: 'no_show',
    verifiedBy: caller.id,
    verifiedByRole: caller.role,
    verifiedAt: new Date(),
  });

  const donor = await User.findById(donorId);
  if (donor) {
    donor.donorProfile.reputationScore = clampScore(
      donor.donorProfile.reputationScore + PENALTY_NO_SHOW
    );
    await donor.save();

    notifyUser(donorId, {
      type: 'system',
      title: 'Missed donation recorded',
      body: `You were marked as a no-show for the ${request.bloodGroup} request at ${request.hospitalName}. Repeated no-shows lower your reputation score.`,
      data: { requestId: request._id },
      channels: ['inapp'],
    }).catch((err) => logger.error('no-show notification failed', err));
  }

  emitRequestUpdate(request);
  return { request: request.toJSON(), donation: donation.toJSON() };
}

/**
 * Mark overdue requests expired (worker). Only active/accepted expire —
 * an in-progress donation shouldn't be cancelled by a timer.
 */
export async function expireOverdueRequests(now = new Date()) {
  const overdue = await requestRepo.list(
    { status: { $in: ['active', 'accepted'] }, expiresAt: { $lte: now } },
    { limit: 200 }
  );

  for (const request of overdue) {
    request.status = 'expired';
    await requestRepo.save(request);
    emitRequestUpdate(request);
    notifyUser(idOf(request.createdBy), {
      type: 'request_expired',
      title: 'Blood request expired',
      body: `Your ${request.bloodGroup} request at ${request.hospitalName} expired without being fulfilled. You can create a new one.`,
      data: { requestId: request._id },
      channels: ['inapp', 'email', 'push'],
    }).catch((err) => logger.error('expiry notification failed', err));
  }
  return overdue.length;
}

/**
 * Escalate unaccepted critical requests up the radius ladder (worker),
 * notifying only donors in the newly covered ring.
 */
export async function escalateCriticalRequests(now = new Date()) {
  const cutoff = new Date(now.getTime() - env.rules.escalationAfterMin * 60 * 1000);
  const candidates = await requestRepo.list(
    { status: 'active', urgency: 'critical', expiresAt: { $gt: now } },
    { limit: 100 }
  );

  let escalated = 0;
  for (const request of candidates) {
    const level = request.escalationLevel ?? 0;
    if (level >= ESCALATION_LADDER_KM.length - 1) continue;
    const lastStep = request.escalatedAt || request.createdAt;
    if (lastStep > cutoff) continue;

    const previousRadiusKm = request.broadcastRadiusKm;
    request.escalationLevel = level + 1;
    request.broadcastRadiusKm = ESCALATION_LADDER_KM[request.escalationLevel];
    request.escalatedAt = now;
    await requestRepo.save(request);
    escalated += 1;

    emitRequestUpdate(request, { broadcastRadiusKm: request.broadcastRadiusKm });
    notifyNearbyDonors(request, {
      minDistanceMeters: previousRadiusKm * 1000,
    }).catch((err) => logger.error('escalation notify failed', err));
    logger.info(
      `escalated critical request ${request._id}: ${previousRadiusKm} → ${request.broadcastRadiusKm} km`
    );
  }
  return escalated;
}

export async function updateStatus(requestId, userId, status) {
  const request = await requestRepo.findById(requestId);
  if (!request) throw ApiError.notFound('Request not found');
  if (idOf(request.createdBy) !== String(userId))
    throw ApiError.forbidden('Only the creator can change status');

  request.status = status;
  await requestRepo.save(request);

  emitRequestUpdate(request);
  return request.toJSON();
}
