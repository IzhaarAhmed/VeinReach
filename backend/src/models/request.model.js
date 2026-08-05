import mongoose from 'mongoose';
import {
  BLOOD_GROUPS,
  URGENCY_LEVELS,
  REQUEST_STATUS,
} from '../constants/index.js';

const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

const bloodRequestSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true, index: true },
    unitsRequired: { type: Number, required: true, min: 1 },

    hospitalName: { type: String, required: true, trim: true },
    hospitalAddress: { type: String, trim: true },
    hospitalLocation: { type: pointSchema, required: true },

    urgency: { type: String, enum: URGENCY_LEVELS, default: 'normal', index: true },
    notes: { type: String, trim: true, maxlength: 1000 },

    status: { type: String, enum: REQUEST_STATUS, default: 'active', index: true },

    // Donors who have accepted / are fulfilling this request.
    acceptedDonors: [
      {
        donor: { type: Schema.Types.ObjectId, ref: 'User' },
        acceptedAt: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
      },
    ],

    // Current broadcast radius (km) — grows as emergencies escalate.
    broadcastRadiusKm: { type: Number, default: 20 },

    // Escalation ladder position (spec: 20 → 50 → 100 km for unfulfilled
    // critical requests) and when the last escalation happened.
    escalationLevel: { type: Number, default: 0 },
    escalatedAt: { type: Date },

    expiresAt: { type: Date, index: true },
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

bloodRequestSchema.index({ hospitalLocation: '2dsphere' });

export const BloodRequest = mongoose.model('BloodRequest', bloodRequestSchema);
