import { Meetup } from '../models/meetup.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { hospitalsNear, drivingEta } from './geo.service.js';
import { notifyUser } from './notification.service.js';
import { getIO } from '../realtime/io.js';
import { logger } from '../utils/logger.js';

/**
 * Create a meetup invite: pick a hospital near the geographic midpoint
 * between the recipient's search point and the donor, compute driving ETAs
 * for both sides, persist, and push a real-time invite to the donor.
 */
export async function createMeetup(recipientId, { donorId, lng, lat, bloodGroup }) {
  if (String(recipientId) === String(donorId))
    throw ApiError.badRequest('You cannot invite yourself');

  const [recipient, donor] = await Promise.all([
    User.findById(recipientId),
    User.findById(donorId),
  ]);
  if (!donor || donor.role !== 'donor') throw ApiError.notFound('Donor not found');
  const donorCoords = donor.location?.coordinates;
  if (!donorCoords?.length)
    throw ApiError.badRequest('This donor has no location on their profile');

  const existing = await Meetup.findOne({
    recipient: recipientId,
    donor: donorId,
    status: 'pending',
  });
  if (existing) throw ApiError.conflict('You already have a pending invite to this donor');

  const recipientOrigin = [lng, lat];
  const midpoint = {
    lng: (lng + donorCoords[0]) / 2,
    lat: (lat + donorCoords[1]) / 2,
  };

  const hospitals = await hospitalsNear({ lat: midpoint.lat, lng: midpoint.lng, limit: 3 });
  if (!hospitals.length)
    throw ApiError.notFound('No hospital found between you and this donor');
  const hospital = hospitals[0];
  const hospitalCoords = [hospital.lng, hospital.lat];

  const [donorEta, recipientEta] = await Promise.all([
    drivingEta(donorCoords, hospitalCoords),
    drivingEta(recipientOrigin, hospitalCoords),
  ]);

  const meetup = await Meetup.create({
    recipient: recipientId,
    donor: donorId,
    bloodGroup,
    hospital: {
      name: hospital.name,
      address: hospital.address,
      location: { type: 'Point', coordinates: hospitalCoords },
    },
    recipientOrigin: { type: 'Point', coordinates: recipientOrigin },
    etaDonorMin: donorEta.minutes,
    etaRecipientMin: recipientEta.minutes,
    distanceDonorKm: donorEta.km,
    distanceRecipientKm: recipientEta.km,
    etaEstimated: donorEta.estimated || recipientEta.estimated,
  });

  const inviteMessage = `${recipient?.fullName || 'A recipient'} needs ${bloodGroup} blood. In ~${donorEta.minutes} minutes you can reach them at ${hospital.name}.`;

  // Real-time invite to the donor's personal room.
  getIO()?.to(`user:${donorId}`).emit('meetup:invite', {
    meetupId: meetup.id,
    from: recipient?.fullName || 'A recipient',
    bloodGroup,
    hospital: { name: hospital.name, address: hospital.address },
    etaMin: donorEta.minutes,
    message: inviteMessage,
  });

  notifyUser(donorId, {
    type: 'meetup_invite',
    title: `🩸 Meetup invite: ${bloodGroup} blood needed`,
    body: inviteMessage,
    data: { meetupId: meetup.id, hospitalName: hospital.name },
    channels: ['inapp', 'email', 'push'],
  }).catch((err) => logger.error('meetup invite notification failed', err));

  return meetup;
}

/** Donor accepts or declines a pending invite; the recipient is notified live. */
export async function respondMeetup(donorId, meetupId, accept) {
  const meetup = await Meetup.findById(meetupId);
  if (!meetup) throw ApiError.notFound('Invite not found');
  if (String(meetup.donor) !== String(donorId))
    throw ApiError.forbidden('This invite is not addressed to you');
  if (meetup.status !== 'pending')
    throw ApiError.conflict(`Invite already ${meetup.status}`);

  meetup.status = accept ? 'accepted' : 'declined';
  meetup.respondedAt = new Date();
  await meetup.save();

  const donor = await User.findById(donorId);
  const responseMessage = accept
    ? `${donor?.fullName || 'The donor'} accepted! Meet at ${meetup.hospital.name} — you can reach it in ~${meetup.etaRecipientMin} minutes.`
    : `${donor?.fullName || 'The donor'} declined your invite.`;

  getIO()?.to(`user:${meetup.recipient}`).emit('meetup:response', {
    meetupId: meetup.id,
    accepted: accept,
    donorName: donor?.fullName || 'The donor',
    hospital: { name: meetup.hospital.name, address: meetup.hospital.address },
    etaRecipientMin: meetup.etaRecipientMin,
    message: responseMessage,
  });

  notifyUser(meetup.recipient, {
    type: 'meetup_response',
    title: accept ? '✅ Meetup accepted' : '❌ Meetup declined',
    body: responseMessage,
    data: { meetupId: meetup.id, accepted: accept },
    channels: ['inapp', 'push'],
  }).catch((err) => logger.error('meetup response notification failed', err));

  return meetup;
}

/** All invites where the user is either side, newest first, with names. */
export async function myMeetups(userId) {
  return Meetup.find({ $or: [{ recipient: userId }, { donor: userId }] })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('recipient', 'fullName bloodGroup')
    .populate('donor', 'fullName bloodGroup');
}
