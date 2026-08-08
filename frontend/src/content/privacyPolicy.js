/**
 * The privacy policy — the canonical text, in one place.
 *
 * This module is the single source of truth: the /privacy page renders it, and
 * `PRIVACY_POLICY_VERSION` in the backend constants must match `version` below
 * (a backend test fails if they drift, because every consent record stores that
 * version and would otherwise point at text nobody was shown).
 *
 * It describes what the code actually does. When you change data handling —
 * a new field, a different retention window, another processor — change it here
 * in the same commit, and bump `version` if the change is material.
 *
 * Block types: { p } paragraph, { ul } bullet list, { dl } term/definition
 * pairs, { contact: true } the configured grievance address.
 */
export const PRIVACY_POLICY = {
  version: '2026-08-08',
  updated: '8 August 2026',

  intro: [
    'VeinReach connects voluntary blood donors with people who need blood. Doing ' +
      'that means handling information that matters: your blood group, where you ' +
      'roughly are, and how to reach you in an emergency.',
    'This policy describes exactly what we collect, who can see it, how long we ' +
      'keep it, and how to get it back or have it erased. It reflects how the ' +
      'platform is actually built, not a generic template.',
  ],

  sections: [
    {
      id: 'what-we-collect',
      heading: 'What we collect, and why',
      body: [
        { p: 'When you register, we ask for:' },
        {
          dl: [
            ['Name, email and mobile number', 'To identify your account, verify it, and let a matched party reach you.'],
            ['Password', 'Stored only as a bcrypt hash. We never hold the password itself and cannot recover it.'],
            ['Blood group', 'The core of the matching engine. This is health information, and we treat it as such — see below.'],
            ['Date of birth and weight', 'Used solely to compute donation eligibility (minimum age, minimum weight). Never shown to other users.'],
            ['Gender', 'Used solely to apply the correct donation cooldown (90 days / 120 days).'],
            ['City and state', 'Shown to other users as your approximate area.'],
            ['Emergency contact', 'Held for emergencies during or after a donation.'],
            ['Precise location (latitude and longitude)', 'Used for distance matching. Never disclosed to another user — see “Your location”.'],
          ],
        },
        {
          p:
            'Later, and only if you choose to: a profile photo, verification or ' +
            'hospital documents, chat messages and attachments, and device tokens ' +
            'so we can send you push notifications.',
        },
        {
          p:
            'We also record security events — sign-in, account changes, moderation ' +
            'actions — together with the IP address they came from. This is how an ' +
            'account compromise or an abuse report can be investigated.',
        },
      ],
    },

    {
      id: 'health-data',
      heading: 'Health information',
      body: [
        {
          p:
            'Your blood group is health data, and your eligibility status is derived ' +
            'from your age, weight and last donation date. We collect the minimum ' +
            'needed to match you safely and nothing more.',
        },
        {
          p:
            'We do not ask for, store, or want medical reports, test results, ' +
            'diagnoses, medication or any other health record. There is nowhere in ' +
            'the platform to put them. Please do not send them through chat.',
        },
        {
          p:
            'Eligibility on VeinReach is an arithmetic check — age, weight, and days ' +
            'since your last donation. It is not a medical screening and is not ' +
            'medical advice. The collecting hospital or blood bank performs the ' +
            'actual clinical assessment, and their decision is the one that counts.',
        },
      ],
    },

    {
      id: 'location',
      heading: 'Your location',
      body: [
        {
          p:
            'Precise coordinates are the most sensitive thing we hold, so they are ' +
            'the most tightly held. Your exact coordinates are never sent to another ' +
            'user. The database query that finds nearby donors excludes the ' +
            'coordinate field outright, so it cannot be leaked by a bug further up.',
        },
        { p: 'What another user sees instead is an approximate distance and your city or state.' },
        {
          p:
            'Your location is only used while you are marked available as a donor, or ' +
            'when you create a request. Turning off availability takes you out of ' +
            'donor search immediately.',
        },
      ],
    },

    {
      id: 'what-others-see',
      heading: 'What other users can see',
      body: [
        { p: 'When you appear in donor search or on a request, other users see:' },
        {
          ul: [
            'Your name and profile photo, if you uploaded one',
            'Your blood group',
            'Your city and state',
            'Approximate distance from the request',
            'Your donation count, reputation score and badges',
            'Whether you are currently eligible to donate — as a yes or no, not the underlying numbers',
          ],
        },
        { p: 'They never see:' },
        {
          ul: [
            'Your exact coordinates',
            'Your date of birth, weight or gender',
            'Your email address, mobile number or emergency contact — until contact is unlocked',
            'Any document you uploaded for verification',
          ],
        },
        {
          p:
            'Contact details stay hidden until a request ties you together or both ' +
            'sides consent. Until then, chat is the only channel.',
        },
      ],
    },

    {
      id: 'processors',
      heading: 'Who else processes your data',
      body: [
        {
          p:
            'We do not sell your data, and we do not share it for advertising. We use ' +
            'these service providers to run the platform:',
        },
        {
          dl: [
            ['MongoDB Atlas', 'The database. Holds everything described above, encrypted in transit and at rest.'],
            ['Render', 'Runs the API server.'],
            ['Cloudflare Pages', 'Serves the web app.'],
            ['Cloudflare R2', 'Stores profile photos, documents, chat attachments and donation certificates.'],
            ['Email provider', 'Sends verification, password-reset and notification email.'],
            ['Firebase Cloud Messaging', 'Delivers push notifications, if you enable them. Optional.'],
            ['SMS provider', 'Sends mobile verification codes, if SMS is enabled. Optional.'],
          ],
        },
        {
          p:
            'We disclose data to a hospital or blood bank only in the context of a ' +
            'donation you took part in — the fact of the donation, its blood group ' +
            'and its date — so they can verify it. Beyond that, we disclose data only ' +
            'where the law requires it.',
        },
      ],
    },

    {
      id: 'retention',
      heading: 'How long we keep things',
      body: [
        {
          p:
            'An automated job deletes data past these windows. They are deliberately ' +
            'short; an operator can shorten them further but the defaults are what we ' +
            'run:',
        },
        {
          dl: [
            ['Chat messages and attachments', '6 months, then deleted along with the files.'],
            ['In-app notifications', '30 days.'],
            ['Requests that expired or were cancelled', '6 months, unless a donation record refers to them.'],
            ['Security and audit logs', '12 months. Kept longest because they are the only record available if an incident is reported late.'],
            ['Donation records', 'Kept indefinitely as your donation history — and as the recipient’s and the hospital’s record of the same event. Anonymized, never deleted, when you close your account.'],
            ['Your account', 'Until you close it.'],
          ],
        },
      ],
    },

    {
      id: 'your-rights',
      heading: 'Your rights',
      body: [
        {
          p:
            'Under India’s Digital Personal Data Protection Act, 2023, and equivalent ' +
            'rights elsewhere, you can:',
        },
        {
          dl: [
            ['Get a copy of your data', 'Profile → Download my data. You get a JSON file containing everything we hold about you, immediately — no request queue.'],
            ['Correct it', 'Edit your profile at any time.'],
            ['Have it erased', 'Profile → Close my account. Takes effect immediately; see the next section for exactly what happens.'],
            ['Withdraw consent', 'Closing your account withdraws it. You can also turn off availability or push notifications without closing anything.'],
            ['Complain', 'Write to our grievance contact below. If we cannot resolve it, you may escalate to the Data Protection Board of India.'],
          ],
        },
        {
          p:
            'Both the copy and the erasure are self-service and take effect at once. ' +
            'You should not have to ask permission to leave.',
        },
      ],
    },

    {
      id: 'deletion',
      heading: 'What happens when you close your account',
      body: [
        {
          p:
            'Closing your account erases your personal data immediately. It is not a ' +
            'flag or a grace period, and it cannot be undone.',
        },
        { p: 'Erased outright:' },
        {
          ul: [
            'Your name, email, mobile number, date of birth, weight, gender, city, state and emergency contact',
            'Your exact coordinates',
            'Your profile photo and every uploaded document, including the stored files',
            'Your chat messages and their attachments',
            'Your notifications and meetup invitations',
            'Requests you created that never resulted in a donation',
            'Any written feedback or report narrative you authored',
            'Every active session and push-notification device',
          ],
        },
        { p: 'Kept, in a form that is no longer linked to you:' },
        {
          ul: [
            'Donation records — blood group, date and hospital, attached to an anonymous donor. This is what a recipient and a verifying hospital keep as their own record of the donation, and blood traceability depends on it. Your name is removed and any certificate bearing it is deleted.',
            'Aggregate counters such as your donation count, which identify nobody.',
            'Moderation reports others filed, and security logs, both of which age out on the schedule above.',
          ],
        },
        {
          p:
            'One consequence worth stating plainly: deleting a one-to-one chat removes ' +
            'it for the other person too. We do this on purpose. Those messages ' +
            'routinely contain the very things you asked us to erase — your phone ' +
            'number, your address, your name — so leaving the other half in place ' +
            'would not be erasure at all.',
        },
      ],
    },

    {
      id: 'security',
      heading: 'How we protect it',
      body: [
        {
          ul: [
            'Passwords hashed with bcrypt. We cannot read them.',
            'Short-lived access tokens with rotating refresh tokens, so a stolen token has a small window.',
            'The refresh token lives in an httpOnly cookie, out of reach of page scripts.',
            'CSRF protection on every state-changing request.',
            'Rate limiting on the API, and stricter limits on sign-in and verification codes.',
            'Input validation on every endpoint, and query sanitisation against database injection.',
            'Private documents are never publicly readable — they are served through short-lived, single-purpose links.',
            'HTTPS everywhere, enforced.',
          ],
        },
        {
          p:
            'No system is perfect. If you find a vulnerability, please report it to ' +
            'the contact below rather than disclosing it publicly, and we will work ' +
            'with you on it.',
        },
      ],
    },

    {
      id: 'children',
      heading: 'Age',
      body: [
        {
          p:
            'VeinReach is not for children. You must be at least 18 to register as a ' +
            'donor, which is also the minimum age to donate blood. If we learn that an ' +
            'account belongs to a child, we will close it and erase the data.',
        },
      ],
    },

    {
      id: 'changes',
      heading: 'Changes to this policy',
      body: [
        {
          p:
            'We record which version of this policy you accepted when you registered. ' +
            'If we change it materially we will publish the new version and ask you to ' +
            'accept it — we will not quietly widen what we do with data you already ' +
            'gave us.',
        },
      ],
    },

    {
      id: 'contact',
      heading: 'Contact',
      body: [
        { p: 'Questions, requests or complaints about your data go to our Grievance Officer:' },
        { contact: true },
        {
          p:
            'We aim to respond within 30 days. If you are not satisfied, you may ' +
            'complain to the Data Protection Board of India.',
        },
      ],
    },
  ],
};

/**
 * The published grievance address. Configured per-deployment so a personal
 * address is never committed to the repository; the fallback is deliberately
 * not a working address, because a policy showing a plausible-looking contact
 * nobody reads is worse than one that admits it is unset.
 */
export const privacyContact = () =>
  import.meta.env.VITE_PRIVACY_CONTACT?.trim() || null;
