import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

/**
 * Dark / light theme toggle. A compact pill that slides a glowing knob between
 * a moon and a sun; the icons cross-fade so the active mode is always obvious.
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isLight}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      className={`theme-toggle group relative inline-flex h-10 w-[68px] shrink-0 items-center rounded-full border border-white/12 bg-white/5 px-1 backdrop-blur transition-colors hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${className}`}
    >
      {/* Track icons (dimmed hints on each side). */}
      <Moon
        className="pointer-events-none absolute left-2.5 h-4 w-4 text-white/35"
        aria-hidden
      />
      <Sun
        className="pointer-events-none absolute right-2.5 h-4 w-4 text-amber-400/60"
        aria-hidden
      />

      {/* Sliding knob. */}
      <span
        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-glow transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isLight
            ? 'translate-x-[28px] bg-gradient-to-br from-amber-300 to-brand-500'
            : 'translate-x-0 bg-gradient-to-br from-ink-700 to-ink-900'
        }`}
      >
        <Sun
          className={`absolute h-[18px] w-[18px] text-white transition-all duration-300 ${
            isLight ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          }`}
          aria-hidden
        />
        <Moon
          className={`absolute h-[18px] w-[18px] text-white transition-all duration-300 ${
            isLight ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
          aria-hidden
        />
      </span>
    </button>
  );
}
