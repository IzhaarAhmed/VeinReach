import { BloodRequest } from '../models/request.model.js';

export const create = (data) => BloodRequest.create(data);

export const findById = (id) =>
  BloodRequest.findById(id)
    .populate('createdBy', 'fullName role city state')
    .populate('acceptedDonors.donor', 'fullName bloodGroup');

export const findByCreator = (userId) =>
  BloodRequest.find({ createdBy: userId })
    .sort({ createdAt: -1 })
    .populate('acceptedDonors.donor', 'fullName bloodGroup');

export const list = (filter = {}, { limit = 50, skip = 0 } = {}) =>
  BloodRequest.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip);

export const save = (doc) => doc.save();
