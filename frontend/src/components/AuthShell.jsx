import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Droplet, ShieldCheck, MapPin, Clock } from 'lucide-react';
import ContrastToggle from './ContrastToggle.jsx';

// Reuse the landing page's 3D scene as an ambient auth background.
const HeroCanvas = lazy(() => import('./HeroCanvas.jsx'));

const TRUST = [
  { icon: ShieldCheck, label: 'Verified & secure' },
  { icon: MapPin, label: 'Location matched' },
  { icon: Clock, label: 'Real-time alerts' },
];

/**
 * Full-screen shell for auth pages: the animated blood-cell canvas sits behind
 * a centered glass card. `wide` widens the card for the register form.
 */
export default function AuthShell({ title, subtitle, children, wide = false }) {
  return (
    <div className="app-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute right-4 top-4 z-20">
        <ContrastToggle />
      </div>

      {/* Animated background */}
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <HeroCanvas />
        </Suspense>
        <div className="absolute inset-0 bg-ink-950/50" />
      </div>

      {/* Card */}
      <div className={`reveal relative z-10 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} card shadow-card`}>
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
              <Droplet className="h-6 w-6 text-white" fill="currentColor" aria-hidden />
            </span>
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            <span className="text-gradient">{title}</span>
          </h1>
          {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
        </div>
        {children}
      </div>

      {/* Trust strip */}
      <div className="absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-6 sm:flex">
        {TRUST.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-white/40">
            <Icon className="h-3.5 w-3.5 text-accent-400/70" aria-hidden /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
