import mongoose from 'mongoose';
import {
  REPORT_TARGET_TYPES,
  REPORT_CATEGORIES,
  REPORT_STATUS,
  MODERATION_ACTIONS,
} from '../constants/index.js';

const { Schema } = mongoose;

/**
 * An abuse / moderation report raised by a user against another user or a
 * request. Reviewed by admins, who resolve it with a moderation action
 * (spec: Admin — review reports, moderate abuse).
 */
const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    // Exactly one of these is set, matching targetType.
    targetUser: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    targetRequest: { type: Schema.Types.ObjectId, ref: 'BloodRequest', index: true },

    category: { type: String, enum: REPORT_CATEGORIES, required: true },
    description: { type: String, trim: true, maxlength: 2000 },

    status: { type: String, enum: REPORT_STATUS, default: 'open', index: true },

    // Set when an admin resolves/dismisses the report.
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    handledAt: { type: Date },
    action: { type: String, enum: MODERATION_ACTIONS, default: 'none' },
    resolutionNote: { type: String, trim: true, maxlength: 2000 },
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

reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
