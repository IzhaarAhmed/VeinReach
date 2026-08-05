import { Donation } from '../models/donation.model.js';

export const create = (data) => Donation.create(data);

export const findById = (id) =>
  Donation.findById(id)
    .populate('donor', 'fullName bloodGroup city state')
    .populate('recipient', 'fullName')
    .populate('request', 'bloodGroup hospitalName urgency');

/** Settled donations where the user is either party, newest first, paginated. */
export const findForUser = (userId, { limit = 20, skip = 0 } = {}) =>
  Donation.find({ $or: [{ donor: userId }, { recipient: userId }] })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('donor', 'fullName bloodGroup')
    .populate('recipient', 'fullName');

export const countForUser = (userId) =>
  Donation.countDocuments({ $or: [{ donor: userId }, { recipient: userId }] });

export const save = (doc) => doc.save();
