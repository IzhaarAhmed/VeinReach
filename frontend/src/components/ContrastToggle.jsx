import { Contrast } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext.jsx';

/** High-contrast mode toggle (spec: High Contrast Mode). */
export default function ContrastToggle() {
  const { highContrast, toggleHighContrast } = usePreferences();
  return (
    <button
      onClick={toggleHighContrast}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      aria-pressed={highContrast}
      aria-label={`High contrast mode ${highContrast ? 'on' : 'off'}`}
      title="Toggle high contrast"
    >
      <Contrast className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}
