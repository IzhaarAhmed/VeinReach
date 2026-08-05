import * as donationRepo from '../repositories/donation.repository.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { feedbackDelta, clampScore } from './reputation.service.js';
import { notifyUser } from './notification.service.js';
import { logger } from '../utils/logger.js';
import { paginate, pageMeta } from '../utils/pagination.js';

const idOf = (v) => String(v?._id ?? v);

/** Donation history for a user (as donor or recipient), paginated. */
export async function history(userId, query = {}) {
  const { page, limit, skip } = paginate(query);
  const [donations, total] = await Promise.all([
    donationRepo.findForUser(userId, { limit, skip }),
    donationRepo.countForUser(userId),
  ]);
  return { donations, meta: pageMeta({ page, limit, total }) };
}

export async function getOne(userId, donationId) {
  const donation = await donationRepo.findById(donationId);
  if (!donation) throw ApiError.notFound('Donation not found');
  const isParty =
    idOf(donation.donor) === String(userId) || idOf(donation.recipient) === String(userId);
  if (!isParty) throw ApiError.forbidden('Not your donation');
  return donation;
}

/**
 * Leave feedback about the other party after a verified donation. The rating
 * adjusts the *other* party's reputation (spec: positive feedback increases,
 * negative decreases). One entry per direction.
 */
export async function leaveFeedback(userId, donationId, { rating, comment }) {
  const donation = await donationRepo.findById(donationId);
  if (!donation) throw ApiError.notFound('Donation not found');
  if (donation.status !== 'verified')
    throw ApiError.badRequest('Feedback is only allowed on verified donations');

  const isDonor = idOf(donation.donor) === String(userId);
  const isRecipient = idOf(donation.recipient) === String(userId);
  if (!isDonor && !isRecipient) throw ApiError.forbidden('Not your donation');

  const field = isRecipient ? 'recipientFeedback' : 'donorFeedback';
  if (donation[field]) throw ApiError.conflict('You have already left feedback');

  donation[field] = { rating, comment, at: new Date() };
  await donationRepo.save(donation);

  // Feedback adjusts the OTHER party's reputation.
  const targetId = isRecipient ? idOf(donation.donor) : idOf(donation.recipient);
  const delta = feedbackDelta(rating);
  if (delta !== 0) {
    const target = await User.findById(targetId);
    if (target) {
      target.donorProfile.reputationScore = clampScore(
        target.donorProfile.reputationScore + delta
      );
      await target.save();
      notifyUser(targetId, {
        type: 'system',
        title: delta > 0 ? '⭐ You received positive feedback' : 'Feedback received',
        body:
          delta > 0
            ? `You received a ${rating}-star rating for the donation at ${donation.hospitalName}.`
            : `You received a ${rating}-star rating. Your reputation score was adjusted.`,
        data: { donationId: donation._id, rating },
        channels: ['inapp'],
      }).catch((err) => logger.error('feedback notification failed', err));
    }
  }

  return donation.toJSON();
}
