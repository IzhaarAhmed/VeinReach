import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Droplet, ShieldCheck, MapPin, Clock } from 'lucide-react';
import ContrastToggle from './ContrastToggle.jsx';
import VeinPulse from './VeinPulse.jsx';

const TRUST = [
  { icon: ShieldCheck, label: 'Private by design' },
  { icon: MapPin, label: 'Location matched' },
  { icon: Clock, label: 'Real-time alerts' },
];

/**
 * Cinematic auth shell — the landing page's language at a fraction of its cost.
 *
 * Same palette, type and glass as the landing, but the vascular convergence is
 * an SVG with CSS-animated pulses rather than a WebGL scene, so the page is
 * interactive immediately and costs nothing on a phone.
 *
 * Split layout on desktop (story on the left, form on the right) deliberately
 * differs from the landing's centred hero, so the two read as siblings rather
 * than duplicates. Below `lg` the story panel drops away entirely and only the
 * form remains.
 *
 * Drop-in replacement for AuthShell: same `title` / `subtitle` / `wide` props.
 */
export default function LuxAuthShell({ title, subtitle, eyebrow, children, wide = false }) {
  // Match the document background so overscroll never flashes the app canvas.
  useEffect(() => {
    document.documentElement.classList.add('lux-root');
    return () => document.documentElement.classList.remove('lux-root');
  }, []);

  return (
    <div className="lux lux-auth">
      <div className="lux-vignette" aria-hidden="true" />
      <div className="lux-grain" aria-hidden="true" />

      <div className="lux-auth__toggle">
        <ContrastToggle />
      </div>

      <div className="lux-auth__grid">
        {/* ── Story panel (desktop only) ─────────────────────────────── */}
        <aside className="lux-auth__story">
          <VeinPulse className="lux-auth__veins" />

          <div className="lux-auth__story-inner">
            <Link to="/" className="lux-brand">
              <span className="lux-brand-mark" aria-hidden="true">
                <Droplet className="h-4 w-4" fill="currentColor" />
              </span>
              VeinReach
            </Link>

            <p className="lux-auth__quote">
              Every drop
              <span className="lux-display-accent">connects a life.</span>
            </p>

            <p className="lux-lede lux-auth__story-body">
              Compatible donors, ranked by distance and reputation, notified the moment a
              request goes live.
            </p>

            <ul className="lux-auth__trust">
              {TRUST.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ── Form panel ─────────────────────────────────────────────── */}
        <main className="lux-auth__panel">
          <div className={`lux-auth__card ${wide ? 'lux-auth__card--wide' : ''}`}>
            {/* Brand repeats here for the mobile layout, where the story panel
                is not rendered at all. */}
            <Link to="/" className="lux-brand lux-auth__card-brand">
              <span className="lux-brand-mark" aria-hidden="true">
                <Droplet className="h-4 w-4" fill="currentColor" />
              </span>
              VeinReach
            </Link>

            <span className="lux-auth__rail" aria-hidden="true" />

            <header className="lux-auth__head">
              {eyebrow && <p className="lux-kicker">{eyebrow}</p>}
              <h1 className="lux-auth__title">{title}</h1>
              {subtitle && <p className="lux-auth__subtitle">{subtitle}</p>}
            </header>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
