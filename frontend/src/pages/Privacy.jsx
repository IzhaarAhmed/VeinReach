import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { PRIVACY_POLICY, privacyContact } from '../content/privacyPolicy.js';

/**
 * The published privacy policy.
 *
 * Deliberately a public route: it has to be readable before you register, since
 * the registration form asks you to accept it. All text comes from
 * content/privacyPolicy.js so there is exactly one copy of the wording.
 */

function Block({ block }) {
  if (block.p) return <p className="text-sm leading-relaxed text-white/65">{block.p}</p>;

  if (block.ul)
    return (
      <ul className="space-y-2">
        {block.ul.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-white/65">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );

  if (block.dl)
    return (
      <dl className="space-y-3">
        {block.dl.map(([term, definition]) => (
          <div key={term} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <dt className="text-sm font-semibold text-white/90">{term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-white/60">{definition}</dd>
          </div>
        ))}
      </dl>
    );

  if (block.contact) return <ContactBlock />;

  return null;
}

function ContactBlock() {
  const address = privacyContact();

  // An unset address says so rather than showing a placeholder that looks real —
  // a contact nobody monitors is worse than an admitted gap.
  if (!address)
    return (
      <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-sm text-amber-200/90">
        A grievance contact has not been configured for this deployment. Set
        <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5 text-xs">VITE_PRIVACY_CONTACT</code>
        before accepting real users.
      </p>
    );

  return (
    <p className="text-sm text-white/65">
      Grievance Officer —{' '}
      <a
        href={`mailto:${address}`}
        className="font-semibold text-brand-400 underline decoration-brand-500/40 underline-offset-4 hover:text-brand-300"
      >
        {address}
      </a>
    </p>
  );
}

export default function Privacy() {
  const { sections } = PRIVACY_POLICY;

  return (
    <div className="app-bg px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to VeinReach
        </Link>

        <header className="mt-8">
          <span className="badge">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-400" aria-hidden />
            Privacy
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Privacy <span className="text-gradient">Policy</span>
          </h1>
          <p className="mt-2 text-xs uppercase tracking-wide text-white/40">
            Version {PRIVACY_POLICY.version} · Updated {PRIVACY_POLICY.updated}
          </p>

          <div className="mt-6 space-y-3">
            {PRIVACY_POLICY.intro.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-white/70">
                {paragraph}
              </p>
            ))}
          </div>
        </header>

        {/* Jump list — the policy is long, and the sections people actually come
            looking for (erasure, retention) are near the bottom. */}
        <nav aria-label="Sections" className="card mt-8">
          <h2 className="label mb-3">On this page</h2>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {sections.map((section, i) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-white/60 transition hover:text-brand-300"
                >
                  <span className="mr-1.5 text-white/30">{i + 1}.</span>
                  {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-8">
              <h2 className="text-xl font-bold tracking-tight text-white">{section.heading}</h2>
              <div className="mt-4 space-y-4">
                {section.body.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            </section>
          ))}
        </main>

        <footer className="mt-14 border-t border-white/10 pt-6">
          <p className="text-xs text-white/40">
            You can download everything we hold about you, or close your account and have it
            erased, from your profile — both take effect immediately.
          </p>
          <Link to="/register" className="btn-primary mt-5 inline-flex">
            Create an account
          </Link>
        </footer>
      </div>
    </div>
  );
}
