import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  BLOOD_GROUPS,
  GENDERS,
  USER_ROLES,
  DONOR_STATUS,
  VERIFICATION_STATUS,
} from '../constants/index.js';

const { Schema } = mongoose;

/**
 * A stored binary asset (in Cloudflare R2). `url` is populated only for public
 * assets (profile images); private documents keep just the `key` and are served
 * via short-lived presigned URLs.
 */
const assetSchema = new Schema(
  {
    key: { type: String, required: true },
    url: { type: String },
    // For documents: what it proves + a moderation status set by an admin.
    docType: { type: String },
    label: { type: String },
    status: { type: String, enum: VERIFICATION_STATUS, default: 'pending' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/* GeoJSON Point — coordinates are [longitude, latitude]. */
const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: 'coordinates must be [longitude, latitude]',
      },
      default: undefined,
    },
  },
  { _id: false }
);

/* Donor-specific profile. Present for users who can donate. */
const donorProfileSchema = new Schema(
  {
    status: { type: String, enum: DONOR_STATUS, default: 'offline' },
    isAvailable: { type: Boolean, default: false },
    lastDonationDate: { type: Date, default: null },
    donationCount: { type: Number, default: 0, min: 0 },
    reputationScore: { type: Number, default: 0 },
    preferredRadiusKm: { type: Number, default: 10, min: 1, max: 200 },
    badges: { type: [String], default: [] },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    mobile: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: USER_ROLES, default: 'donor', index: true },

    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true, index: true },
    gender: { type: String, enum: GENDERS, required: true },
    dateOfBirth: { type: Date, required: true },
    weight: { type: Number, required: true, min: 0 },

    city: { type: String, trim: true },
    state: { type: String, trim: true },
    emergencyContact: { type: String, trim: true },

    location: { type: pointSchema, default: undefined },

    donorProfile: { type: donorProfileSchema, default: () => ({}) },

    // Public profile image (R2). null until the user uploads one.
    avatar: { type: assetSchema, default: undefined },

    // Verification / hospital documents (R2). Private — served via presigned URLs.
    documents: { type: [assetSchema], default: [] },

    verification: {
      status: { type: String, enum: VERIFICATION_STATUS, default: 'unverified' },
      emailVerified: { type: Boolean, default: false },
      mobileVerified: { type: Boolean, default: false },
      // Hashed one-time token for the email verification link.
      emailTokenHash: { type: String, select: false },
      emailTokenExpires: { type: Date, select: false },
      // Hashed mobile OTP + metadata (6-digit code, short TTL, attempt cap).
      mobileOtpHash: { type: String, select: false },
      mobileOtpExpires: { type: Date, select: false },
      mobileOtpAttempts: { type: Number, default: 0, select: false },
      mobileOtpLastSentAt: { type: Date, select: false },
    },

    /**
     * Password reset via emailed OTP. Everything here is hashed at rest and
     * `select: false`, so a stray query can never return it. The ticket is
     * issued only after the OTP checks out and lets the final step set a new
     * password without replaying the code.
     */
    passwordReset: {
      otpHash: { type: String, select: false },
      otpExpires: { type: Date, select: false },
      attempts: { type: Number, default: 0, select: false },
      lastSentAt: { type: Date, select: false },
      ticketHash: { type: String, select: false },
      ticketExpires: { type: Date, select: false },
    },

    isSuspended: { type: Boolean, default: false },

    /**
     * Set when the user closes their account. The document is kept as an
     * anonymized tombstone rather than removed, because donations reference it
     * and deleting the row would erase the recipient's and the verifying
     * hospital's own records too. Every personal field is overwritten first
     * (see privacy.service.js), so a tombstone holds no personal data.
     *
     * Indexed because every donor-facing query has to exclude these.
     */
    deletedAt: { type: Date, default: null, index: true },

    /**
     * Which version of the privacy policy this account accepted, and when.
     * Records consent at registration; comparing against
     * PRIVACY_POLICY_VERSION identifies users who have not seen the current text.
     */
    consent: {
      privacyVersion: { type: String },
      acceptedAt: { type: Date },
    },

    // Hashed refresh tokens currently valid for this user (supports multi-device + rotation).
    refreshTokens: { type: [String], default: [], select: false },

    // FCM device tokens for push notifications (capped, deduped).
    fcmTokens: { type: [String], default: [], select: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.refreshTokens;
        delete ret.fcmTokens;
        delete ret.passwordReset;
        if (ret.verification) {
          delete ret.verification.emailTokenHash;
          delete ret.verification.emailTokenExpires;
          delete ret.verification.mobileOtpHash;
          delete ret.verification.mobileOtpExpires;
          delete ret.verification.mobileOtpAttempts;
          delete ret.verification.mobileOtpLastSentAt;
        }
        // Never leak raw document keys in the generic serializer.
        if (Array.isArray(ret.documents))
          ret.documents = ret.documents.map((d) => ({
            id: d._id ?? d.id,
            docType: d.docType,
            label: d.label,
            status: d.status,
            uploadedAt: d.uploadedAt,
          }));
        delete ret.__v;
        return ret;
      },
    },
  }
);

/* Geospatial index for nearby-donor queries (spec: 2dsphere index). */
userSchema.index({ location: '2dsphere' });

/**
 * findById that never hands back a closed account.
 *
 * Use this wherever the id comes from somebody else — a chat peer, a meetup
 * invitee, a report target. A tombstone is a real document with a real _id, so a
 * plain findById happily returns one, and the caller then builds new records
 * around an account that asked to be erased.
 *
 * `deletedAt: null` also matches documents predating the field, which is what
 * makes this safe to adopt without a migration.
 */
userSchema.statics.findActiveById = function findActiveById(id) {
  return this.findOne({ _id: id, deletedAt: null });
};

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
