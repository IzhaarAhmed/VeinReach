export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const GENDERS = ['male', 'female', 'other'];

export const USER_ROLES = ['donor', 'recipient', 'hospital', 'bloodbank', 'admin'];

/**
 * Roles a user may pick at self-registration. hospital/bloodbank require
 * document verification (assigned by an admin), admin is never self-service.
 */
export const SELF_REGISTER_ROLES = ['donor', 'recipient'];

export const DONOR_STATUS = ['available', 'busy', 'offline', 'ineligible'];

export const URGENCY_LEVELS = ['critical', 'urgent', 'normal'];

export const REQUEST_STATUS = [
  'active',
  'accepted',
  'in_progress',
  'fulfilled',
  'expired',
  'cancelled',
];

export const VERIFICATION_STATUS = ['unverified', 'pending', 'verified', 'rejected'];

export const MEETUP_STATUS = ['pending', 'accepted', 'declined', 'cancelled'];

/** Terminal states for a settled donation record (the history ledger). */
export const DONATION_STATUS = ['verified', 'rejected', 'no_show'];

/** Default geospatial search radii in kilometers (spec: Smart Location Matching). */
export const SEARCH_RADII_KM = [5, 10, 20, 50];

/** Emergency broadcast escalation ladder in kilometers. */
export const ESCALATION_LADDER_KM = [20, 50, 100];

/* ── In-app chat ───────────────────────────────────────────────────────── */

/** Per-message delivery lifecycle (spec: delivery status + read receipts). */
export const MESSAGE_STATUS = ['sent', 'delivered', 'read'];

export const CONVERSATION_STATUS = ['active', 'archived'];

/* ── File storage (Cloudflare R2) ──────────────────────────────────────── */

/**
 * What a client may upload, and the content types allowed for each. Keys map to
 * an R2 prefix; the spec permits only profile images, verification/hospital
 * documents, and chat attachments — never application data.
 */
export const UPLOAD_PURPOSES = {
  profile_image: ['image/png', 'image/jpeg', 'image/webp'],
  verification_doc: ['image/png', 'image/jpeg', 'application/pdf'],
  hospital_doc: ['image/png', 'image/jpeg', 'application/pdf'],
  chat_attachment: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
};

/** Roles that may upload an organization/hospital verification document. */
export const ORG_ROLES = ['hospital', 'bloodbank'];

/* ── Moderation & reports ──────────────────────────────────────────────── */

export const REPORT_TARGET_TYPES = ['user', 'request'];

export const REPORT_CATEGORIES = [
  'spam',
  'fake_request',
  'no_show',
  'abuse',
  'fraud',
  'impersonation',
  'other',
];

export const REPORT_STATUS = ['open', 'reviewing', 'resolved', 'dismissed'];

/** Moderation actions an admin can apply when resolving a report. */
export const MODERATION_ACTIONS = ['none', 'warn', 'suspend', 'unsuspend', 'reputation_penalty'];

/* ── Blood bank stock ──────────────────────────────────────────────────── */

/**
 * Per-blood-group stock level a blood bank publishes. `low`/`critical`/`out`
 * are shortages (spec: publish stock shortages); `available` is availability.
 */
export const STOCK_LEVELS = ['available', 'low', 'critical', 'out'];

/* ── Privacy ───────────────────────────────────────────────────────────── */

/**
 * Version of the privacy policy a user consented to at registration, stored on
 * the account. Bump this whenever the policy changes materially — the stored
 * value is what lets you tell who has yet to accept the current text.
 *
 * Must match PRIVACY_POLICY.version in frontend/src/content/privacyPolicy.js.
 */
export const PRIVACY_POLICY_VERSION = '2026-08-08';

/**
 * Sentinels written over a closed account's personal fields. The schema marks
 * most of them `required`, so anonymizing cannot simply unset them — it
 * overwrites with a value that is valid, obviously non-personal, and impossible
 * to confuse with real data.
 *
 * `.invalid` is reserved by RFC 2606, so the tombstone email can never collide
 * with, or be mistaken for, a deliverable address. It stays per-user unique
 * because `email` carries a unique index.
 */
export const ANONYMIZED = {
  fullName: 'Deleted user',
  emailFor: (id) => `deleted-${id}@deleted.invalid`,
  mobile: 'deleted',
  // Unix epoch — a valid Date that is transparently not a real date of birth.
  dateOfBirth: new Date(0),
  weight: 0,
  gender: 'other',
};
