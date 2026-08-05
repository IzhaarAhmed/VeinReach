import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password field with a show/hide eye toggle. Drop-in replacement for a plain
 * `<input type="password" className="input" />` — forwards every input prop
 * (id, value, onChange, required, minLength, autoComplete, …) and just manages
 * its own reveal state. The toggle is keyboard-reachable and reports its state
 * via aria-pressed for screen readers.
 *
 * Forwards its ref to the underlying <input> so callers can focus it (the
 * password reset flow moves focus here when its step becomes active).
 */
const PasswordInput = forwardRef(function PasswordInput(
  { className = 'input', ...props },
  ref
) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        className={`${className} pr-11`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-pressed={show}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-lg text-white/45 transition hover:text-white/80 focus:outline-none focus-visible:text-white focus-visible:ring-2 focus-visible:ring-accent-500/50"
      >
        {show ? (
          <EyeOff className="h-[18px] w-[18px]" aria-hidden />
        ) : (
          <Eye className="h-[18px] w-[18px]" aria-hidden />
        )}
      </button>
    </div>
  );
});

export default PasswordInput;
