import { Droplet, HeartPulse, Trophy, Crown, Medal, Star } from 'lucide-react';

const BADGE_META = {
  first_donation: { icon: Droplet, label: 'First Donation', tone: 'text-brand-300 bg-brand-600/15' },
  lifesaver: { icon: HeartPulse, label: 'Lifesaver', tone: 'text-rose-300 bg-rose-500/15' },
  hero_donor: { icon: Trophy, label: 'Hero Donor', tone: 'text-amber-300 bg-amber-500/15' },
  community_champion: { icon: Crown, label: 'Community Champion', tone: 'text-accent-300 bg-accent-500/15' },
};

/** Donor reputation score + earned badges (spec: Reputation System / Badges). */
export default function BadgeShelf({ profile }) {
  if (!profile) return null;
  const badges = profile.badges || [];

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Reputation &amp; badges</span>
        <span className="badge border-amber-500/30 text-amber-200">
          <Star className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
          {profile.reputationScore ?? 0} pts · {profile.donationCount ?? 0} donations
        </span>
      </div>
      {badges.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/50">
          <Medal className="h-5 w-5 text-white/30" aria-hidden />
          Donate to earn your first badge — the First Donation badge is one donation away.
        </div>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {badges.map((b) => {
            const meta = BADGE_META[b] || { icon: Medal, label: b, tone: 'text-white/70 bg-white/5' };
            const Icon = meta.icon;
            return (
              <li key={b} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tone}`}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="text-sm font-medium">{meta.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
