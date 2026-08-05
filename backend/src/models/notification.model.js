import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * In-app notification. One document per user per event — this is what the
 * notification bell lists, and what makes alerts reach donors who were
 * offline when the socket event fired.
 */
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // request_new | request_update | request_expired | donation_confirmed |
    // meetup_invite | meetup_response | chat_message | system
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    data: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
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

notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
