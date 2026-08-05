import mongoose from 'mongoose';
import { BLOOD_GROUPS, DONATION_STATUS } from '../constants/index.js';

const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }, // [lng, lat]
  },
  { _id: false }
);

/** One party's feedback about the other after a verified donation. */
const feedbackSchema = new Schema(
  {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 500 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Immutable-ish record of a settled donation — the donation-history ledger.
 * Created only at a terminal outcome (verified / no_show / rejected); a donor
 * who has merely accepted a request lives in request.acceptedDonors until then.
 */
const donationSchema = new Schema(
  {
    request: { type: Schema.Types.ObjectId, ref: 'BloodRequest', required: true, index: true },
    donor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    units: { type: Number, default: 1, min: 1 },

    hospitalName: { type: String, required: true },
    hospitalAddress: { type: String },
    hospitalLocation: { type: pointSchema },

    status: { type: String, enum: DONATION_STATUS, required: true, index: true },

    // Who confirmed it, and in what capacity (creator vs a hospital account).
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedByRole: { type: String },
    verifiedAt: { type: Date },

    // Mutual feedback (drives two-way reputation). One entry per direction.
    recipientFeedback: { type: feedbackSchema, default: undefined },
    donorFeedback: { type: feedbackSchema, default: undefined },

    // Donation certificate (generated + stored in R2 during P3).
    certificate: {
      key: { type: String },
      url: { type: String },
      issuedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// A donor can only have one settled record per request.
donationSchema.index({ request: 1, donor: 1 }, { unique: true });

export const Donation = mongoose.model('Donation', donationSchema);
