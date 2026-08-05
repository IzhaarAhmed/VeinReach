import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Append-only audit log of security-relevant actions (spec: Audit Logging).
 * Written fire-and-forget from the request boundary; never mutated after
 * creation (updatedAt disabled).
 */
const auditSchema = new Schema(
  {
    // Who performed the action (null for anonymous/pre-auth events).
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: { type: String },

    // Dotted action name, e.g. 'auth.login', 'admin.suspend'.
    action: { type: String, required: true, index: true },

    // What the action was about, if anything.
    targetType: { type: String },
    targetId: { type: String },

    ip: { type: String },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

auditSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditSchema);
