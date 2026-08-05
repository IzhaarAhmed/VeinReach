import mongoose from 'mongoose';
import { BLOOD_GROUPS, MEETUP_STATUS } from '../constants/index.js';

const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

/**
 * A meetup invite: a recipient proposes a hospital (roughly halfway between
 * them and a donor) where the donation can happen, with driving ETAs for both
 * sides. The donor accepts or declines; both parties are notified in real time.
 */
const meetupSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    donor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },

    hospital: {
      name: { type: String, required: true },
      address: { type: String },
      location: { type: pointSchema, required: true },
    },

    // Recipient's search origin — kept server-side for ETA math, stripped in
    // toJSON so the donor never sees the recipient's exact coordinates.
    recipientOrigin: { type: pointSchema, required: true },

    etaDonorMin: { type: Number, required: true },
    etaRecipientMin: { type: Number, required: true },
    distanceDonorKm: { type: Number },
    distanceRecipientKm: { type: Number },
    etaEstimated: { type: Boolean, default: false },

    status: { type: String, enum: MEETUP_STATUS, default: 'pending', index: true },
    respondedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.recipientOrigin;
        return ret;
      },
    },
  }
);

export const Meetup = mongoose.model('Meetup', meetupSchema);
