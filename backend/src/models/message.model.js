import mongoose from 'mongoose';
import { MESSAGE_STATUS } from '../constants/index.js';

const { Schema } = mongoose;

/** An uploaded file shared in chat (R2). */
const attachmentSchema = new Schema(
  {
    key: { type: String, required: true },
    url: { type: String },
    contentType: { type: String },
    name: { type: String },
    sizeBytes: { type: Number },
  },
  { _id: false }
);

/**
 * One chat message. `status` advances sent → delivered → read, driving the
 * delivery-status ticks and read receipts (spec).
 */
const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    text: { type: String, trim: true, maxlength: 4000 },
    attachment: { type: attachmentSchema, default: undefined },

    status: { type: String, enum: MESSAGE_STATUS, default: 'sent', index: true },
    deliveredAt: { type: Date },
    readAt: { type: Date },
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

// A message must carry text or an attachment (or both) — never empty.
messageSchema.pre('validate', function requireContent(next) {
  if (!this.text && !this.attachment) next(new Error('Message must have text or an attachment'));
  else next();
});

messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
