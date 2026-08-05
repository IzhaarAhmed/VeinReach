import mongoose from 'mongoose';
import { CONVERSATION_STATUS } from '../constants/index.js';

const { Schema } = mongoose;

/** Denormalized snapshot of the newest message, for the conversation list. */
const lastMessageSchema = new Schema(
  {
    text: { type: String },
    hasAttachment: { type: Boolean, default: false },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date },
  },
  { _id: false }
);

/**
 * A 1:1 chat between two users. `pairKey` (sorted participant ids joined) makes
 * the pair unique so get-or-create never races into duplicate threads.
 *
 * Contact info (phone/email) is hidden until `contactUnlocked` — set when the
 * conversation is tied to a request both parties are on, or when both consent
 * (spec: hide personal phone numbers until request accepted OR both consent).
 */
const conversationSchema = new Schema(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
      validate: { validator: (v) => v.length === 2, message: 'exactly two participants' },
      index: true,
    },
    pairKey: { type: String, required: true, unique: true },

    // The request this conversation is about, if any (unlocks contact reveal).
    request: { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },

    contactUnlocked: { type: Boolean, default: false },
    consents: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },

    lastMessage: { type: lastMessageSchema, default: undefined },
    status: { type: String, enum: CONVERSATION_STATUS, default: 'active' },
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

/** Stable key for a participant pair regardless of order. */
export function pairKeyFor(a, b) {
  return [String(a), String(b)].sort().join(':');
}

export const Conversation = mongoose.model('Conversation', conversationSchema);
