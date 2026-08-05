import mongoose from 'mongoose';
import { BLOOD_GROUPS, STOCK_LEVELS } from '../constants/index.js';

const { Schema } = mongoose;

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

/** One blood group's level at a bank. */
const inventoryItemSchema = new Schema(
  {
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    units: { type: Number, default: 0, min: 0 },
    level: { type: String, enum: STOCK_LEVELS, default: 'available' },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * A blood bank's published inventory (spec: Blood Bank Portal — publish stock
 * shortages + availability). One document per bank account, discoverable by
 * location so recipients can find nearby stock.
 */
const bloodStockSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    organizationName: { type: String, trim: true },
    address: { type: String, trim: true },
    location: { type: pointSchema, default: undefined },

    inventory: { type: [inventoryItemSchema], default: [] },

    lastPublishedAt: { type: Date },
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

bloodStockSchema.index({ location: '2dsphere' });

export const BloodStock = mongoose.model('BloodStock', bloodStockSchema);
