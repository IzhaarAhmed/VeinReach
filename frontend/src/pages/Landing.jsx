import { lazy, Suspense, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Droplet,
  ArrowRight,
  Radar,
  Siren,
  ShieldCheck,
  Waypoints,
  UserPlus,
  HeartHandshake,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Reveal, { CINEMATIC } from '../components/landing/Reveal.jsx';
import Counter from '../components/landing/Counter.jsx';
import useQuality from '../components/landing/useQuality.js';

/* Three.js + R3F are ~200 kB gzipped. Split them out so the hero copy paints
   immediately and the scene fades in behind it a moment later. */
const VascularScene = lazy(() => import('../components/landing/VascularScene.jsx'));

/* ── Content ───────────────────────────────────────────────────────────────
   Every claim below maps to something the API actually does — the
   compatibility matrix, the radar aggregation, the 20→50→100 km escalation
   ladder, and the contact-reveal gate. Keep it that way when editing. */

const PILLARS = [
  {
    icon: Waypoints,
    title: 'Real compatibility, not guesswork',
    body: 'Matching runs on the full red-cell compatibility matrix. Exact types rank first, compatible donors right behind — incompatible ones never surface at all.',
  },
  {
    icon: Radar,
    title: 'A live donor radar',
    body: 'Available, compatible donors near a hospital, counted by distance ring and kept current over a socket as people come online.',
  },
  {
    icon: Siren,
    title: 'Emergencies that escalate themselves',
    body: 'A critical request nobody answers widens on its own — 20 km, then 50, then 100 — reaching further until someone can help.',
  },
  {
    icon: ShieldCheck,
    title: 'Private until it needs not to be',
    body: 'Exact coordinates, phone numbers and health records stay hidden. Contact details unlock only once a request is accepted or both sides agree.',
  },
];

const STEPS = [
  {
    step: 'Step 01',
    icon: UserPlus,
    title: 'Create your profile',
    body: 'Blood group, location and availability. Under two minutes, and eligibility is worked out for you from age, weight and your last donation.',
  },
  {
    step: 'Step 02',
    icon: Droplet,
    title: 'Raise or answer a request',
    body: 'Post what you need and where, or accept a request near you. Compatible donors in range are notified the moment it goes live.',
  },
  {
    step: 'Step 03',
    icon: HeartHandshake,
    title: 'Meet, donate, verify',
    body: 'Coordinate over secure in-app chat. The hospital or recipient confirms the donation, and your certificate is issued automatically.',
  },
];

const STATS = [
  { value: 8, label: 'Blood groups matched on the full compatibility matrix' },
  { value: 100, suffix: ' km', label: 'Maximum emergency broadcast reach' },
  { value: 60, prefix: '<', suffix: 's', label: 'To raise a request when it matters' },
  { value: 4, label: 'Roles connected: donors, recipients, hospitals and blood banks' },
];

/* PLACEHOLDER COPY — illustrative, not real people. Replace with genuine,
   consented testimonials (or delete this section) before going live. */
const TESTIMONIALS = [
  {
    quote:
      'The request went out at 2am and three compatible donors had accepted before we finished the paperwork. That is the part that still gets me.',
    who: 'Night-shift coordinator',
    role: 'Tertiary hospital, illustrative example',
  },
  {
    quote:
      'I had no idea I was the right type for someone four kilometres away. Now I get a notification, and I know exactly where to go.',
    who: 'Regular donor',
    role: 'O-negative, illustrative example',
  },
  {
    quote:
      'We publish a shortage and the people who can actually fix it hear about it the same hour. It changed how we plan our week.',
    who: 'Blood bank lead',
    role: 'Regional centre, illustrative example',
  },
];

export default function Landing() {
  const { user } = useAuth();
  const { reduced, quality } = useQuality();
  const prefersReduced = useReducedMotion();

  const donorTo = user ? '/dashboard' : '/register';
  const requestTo = user ? '/dashboard/requests/new' : '/register';

  /* Paint the document black for the landing only, so overscroll bounce never
     flashes the app's slate canvas behind this page. */
  useEffect(() => {
    document.documentElement.classList.add('lux-root');
    return () => document.documentElement.classList.remove('lux-root');
  }, []);

  const rise = (delay) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 1, delay, ease: CINEMATIC },
        };

  return (
    <div className="lux">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <Suspense fallback={null}>
        <VascularScene reduced={reduced} quality={quality} />
      </Suspense>
      <div className="lux-vignette" aria-hidden="true" />
      <div className="lux-grain" aria-hidden="true" />

      <div className="lux-content">
        {/* ── Nav ─────────────────────────────────────────────────────── */}
        <header className="lux-nav">
          <Link to="/" className="lux-brand" aria-label="VeinReach home">
            <span className="lux-brand-mark" aria-hidden="true">
              <Droplet className="h-4 w-4" fill="currentColor" />
            </span>
            VeinReach
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
            {user ? (
              <Link to="/dashboard" className="lux-btn lux-btn--ghost lux-btn--sm">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="lux-navlink hidden sm:inline-block">
                  Log in
                </Link>
                <Link to="/register" className="lux-btn lux-btn--ghost lux-btn--sm">
                  Register
                </Link>
              </>
            )}
          </nav>
        </header>

        <main id="main">
          {/* ── Hero ──────────────────────────────────────────────────── */}
          {/* Symmetric vertical padding reserves room for the overlaid nav and
              the scroll cue, so the copy stays centred on tall screens without
              colliding with either on a short landscape phone. */}
          <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-5 py-28 text-center">
            <motion.span className="lux-eyebrow" {...rise(0.1)}>
              <span className="lux-eyebrow-dot" aria-hidden="true" />
              Connecting donors and recipients in real time
            </motion.span>

            <motion.h1 className="lux-display mt-7 max-w-4xl" {...rise(0.22)}>
              Every Drop
              <span className="lux-display-accent">Connects a Life.</span>
            </motion.h1>

            <motion.p className="lux-lede mt-7 max-w-xl" {...rise(0.36)}>
              VeinReach intelligently connects blood donors with recipients faster than ever —
              making every second count during emergencies.
            </motion.p>

            <motion.div
              className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
              {...rise(0.5)}
            >
              <Link to={donorTo} className="lux-btn lux-btn--primary w-full sm:w-auto">
                Become a Donor
                <ArrowRight className="lux-btn__icon h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to={requestTo} className="lux-btn lux-btn--ghost w-full sm:w-auto">
                Request Blood
              </Link>
            </motion.div>

            <motion.div
              className="lux-cue absolute bottom-8 left-1/2 -translate-x-1/2"
              {...rise(0.9)}
            >
              <span className="lux-cue__rail" aria-hidden="true" />
              Scroll
            </motion.div>
          </section>

          {/* ── Why VeinReach ─────────────────────────────────────────── */}
          <section className="lux-section" aria-labelledby="why-heading">
            <div className="lux-shell">
              <Reveal>
                <p className="lux-kicker">Why VeinReach</p>
                <h2 id="why-heading" className="lux-h2 mt-4 max-w-2xl">
                  Built for the hour when everything depends on speed.
                </h2>
                <p className="lux-lede mt-5 max-w-xl">
                  Four things decide whether a request is answered in time. We built the platform
                  around exactly those.
                </p>
              </Reveal>

              <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {PILLARS.map((item, i) => (
                  <Reveal key={item.title} delay={i * 0.08}>
                    <article className="lux-card">
                      <span className="lux-card__icon" aria-hidden="true">
                        <item.icon className="h-5 w-5" />
                      </span>
                      <h3 className="lux-card__title">{item.title}</h3>
                      <p className="lux-card__body">{item.body}</p>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* ── How it works ──────────────────────────────────────────── */}
          <section id="how" className="lux-section" aria-labelledby="how-heading">
            <div className="lux-shell">
              <Reveal className="text-center">
                <p className="lux-kicker">How it works</p>
                <h2 id="how-heading" className="lux-h2 mx-auto mt-4 max-w-xl">
                  Three steps between a request and a life.
                </h2>
              </Reveal>

              <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
                {STEPS.map((item, i) => (
                  <Reveal key={item.step} delay={i * 0.1}>
                    <article className="lux-card">
                      <div className="flex items-center justify-between">
                        <span className="lux-card__icon" aria-hidden="true">
                          <item.icon className="h-5 w-5" />
                        </span>
                        <span className="lux-card__step">{item.step}</span>
                      </div>
                      <h3 className="lux-card__title">{item.title}</h3>
                      <p className="lux-card__body">{item.body}</p>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* ── Statistics ────────────────────────────────────────────── */}
          <section className="lux-section" aria-labelledby="stats-heading">
            <div className="lux-shell">
              <Reveal>
                <hr className="lux-rule" />
              </Reveal>
              <h2 id="stats-heading" className="sr-only">
                Platform capabilities in numbers
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-12 pt-16 lg:grid-cols-4">
                {STATS.map((stat, i) => (
                  <Reveal key={stat.label} delay={i * 0.08} className="text-center">
                    <div className="lux-stat__value">
                      <Counter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                    </div>
                    <p className="lux-stat__label mx-auto max-w-[15rem]">{stat.label}</p>
                  </Reveal>
                ))}
              </div>
              <Reveal>
                <hr className="lux-rule mt-16" />
              </Reveal>
            </div>
          </section>

          {/* ── Testimonials ──────────────────────────────────────────── */}
          <section className="lux-section" aria-labelledby="voices-heading">
            <div className="lux-shell">
              <Reveal>
                <p className="lux-kicker">Voices from the network</p>
                <h2 id="voices-heading" className="lux-h2 mt-4 max-w-2xl">
                  The people on both ends of a request.
                </h2>
              </Reveal>

              <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
                {TESTIMONIALS.map((item, i) => (
                  <Reveal key={item.who} delay={i * 0.1}>
                    <figure className="lux-card">
                      <span className="lux-quote__mark" aria-hidden="true">
                        &ldquo;
                      </span>
                      <blockquote className="lux-quote mt-3">{item.quote}</blockquote>
                      <figcaption>
                        <div className="lux-quote__who">{item.who}</div>
                        <div className="lux-quote__role">{item.role}</div>
                      </figcaption>
                    </figure>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* ── Call to action ────────────────────────────────────────── */}
          <section className="lux-section" aria-labelledby="cta-heading">
            <Reveal className="lux-shell text-center">
              <span className="lux-eyebrow">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Free for donors, always
              </span>
              <h2 id="cta-heading" className="lux-h2 mx-auto mt-7 max-w-2xl">
                Somewhere nearby, your blood type is the one they are looking for.
              </h2>
              <p className="lux-lede mx-auto mt-6 max-w-lg">
                Join the donors, hospitals and blood banks making blood reachable for everyone.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to={donorTo} className="lux-btn lux-btn--primary">
                  Become a Donor
                  <ArrowRight className="lux-btn__icon h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to={requestTo} className="lux-btn lux-btn--ghost">
                  Request Blood
                </Link>
              </div>
            </Reveal>
          </section>
        </main>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="lux-footer">
          <div className="lux-shell">
            <hr className="lux-rule" />
            <div className="mt-10 flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div className="lux-brand">
                <span className="lux-brand-mark" aria-hidden="true">
                  <Droplet className="h-4 w-4" fill="currentColor" />
                </span>
                VeinReach
              </div>

              <nav className="flex items-center gap-1" aria-label="Footer">
                <a href="#how" className="lux-navlink">
                  How it works
                </a>
                <Link to="/login" className="lux-navlink">
                  Log in
                </Link>
                <Link to="/register" className="lux-navlink">
                  Register
                </Link>
              </nav>
            </div>

            <p className="mt-8 text-center sm:text-left">
              Blood donation, reachable for everyone.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
