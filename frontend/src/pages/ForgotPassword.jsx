import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MailCheck } from 'lucide-react';
import { api, unwrap, friendlyError } from '../lib/api.js';
import AuthShell from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

/* Matches the server's OTP_RESEND_COOLDOWN_SEC default. Purely cosmetic — the
   API enforces the real cooldown regardless of what this timer says. */
const RESEND_COOLDOWN_SEC = 60;
const MIN_PASSWORD = 8;

/** a****z@example.com — enough to confirm the right inbox, not enough to leak one. */
function maskEmail(email) {
  const [name = '', domain = ''] = email.split('@');
  if (name.length <= 2) return `${name[0] ?? ''}***@${domain}`;
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 6))}${name.at(-1)}@${domain}`;
}

/**
 * Password reset in three steps: request a code, verify it, choose a new
 * password. The middle step exchanges the code for a short-lived ticket, so a
 * wrong code is reported before the user types a password — and the code is
 * never replayed on the final request.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef(null);
  const passwordRef = useRef(null);

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Move focus to the field that just became relevant.
  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
    if (step === 'password') passwordRef.current?.focus();
  }, [step]);

  const sendCode = async ({ resend = false } = {}) => {
    setError('');
    setBusy(true);
    try {
      await unwrap(api.post('/auth/forgot-password', { email }));
      setCooldown(RESEND_COOLDOWN_SEC);
      setNotice(
        resend
          ? 'If that email is registered, another code is on its way.'
          : 'If that email is registered, a reset code is on its way.'
      );
      setStep('code');
    } catch (err) {
      setError(friendlyError(err, 'Could not send the reset code'));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await unwrap(api.post('/auth/verify-reset-otp', { email, code }));
      setTicket(data.ticket);
      setNotice('');
      setStep('password');
    } catch (err) {
      setError(friendlyError(err, 'That code did not work'));
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await unwrap(api.post('/auth/reset-password', { email, ticket, password }));
      setStep('done');
    } catch (err) {
      setError(friendlyError(err, 'Could not update your password'));
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep('email');
    setCode('');
    setTicket('');
    setPassword('');
    setConfirm('');
    setError('');
    setNotice('');
  };

  const COPY = {
    email: { title: 'Forgot password', subtitle: 'We will email you a code to reset it' },
    code: { title: 'Check your email', subtitle: `Enter the code sent to ${maskEmail(email)}` },
    password: { title: 'Choose a new password', subtitle: 'Make it something only you would guess' },
    done: { title: 'Password updated', subtitle: 'You can now log in with your new password' },
  }[step];

  return (
    <AuthShell title={COPY.title} subtitle={COPY.subtitle}>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-brand-500/30 bg-brand-600/15 p-3 text-sm text-brand-200"
        >
          {error}
        </div>
      )}
      {notice && !error && (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-xl border border-accent-500/30 bg-accent-600/10 p-3 text-sm text-accent-200"
        >
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{notice}</span>
        </div>
      )}

      {/* ── Step 1: email ─────────────────────────────────────────────── */}
      {step === 'email' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
          className="space-y-4"
        >
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset code'}
          </button>
        </form>
      )}

      {/* ── Step 2: code ──────────────────────────────────────────────── */}
      {step === 'code' && (
        <form onSubmit={verifyCode} className="space-y-4">
          <div>
            <label className="label" htmlFor="code">
              6-digit code
            </label>
            <input
              ref={codeRef}
              id="code"
              className="input text-center font-mono text-lg tracking-[0.55em]"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="······"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <p className="mt-2 text-xs text-white/45">
              The code expires in 10 minutes and can only be used once.
            </p>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy || code.length < 6}>
            {busy ? 'Verifying…' : 'Verify code'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={restart}
              className="inline-flex items-center gap-1.5 text-white/55 hover:text-white/85"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Use another email
            </button>

            <button
              type="button"
              onClick={() => sendCode({ resend: true })}
              disabled={busy || cooldown > 0}
              className="text-accent-300 hover:text-accent-200 disabled:cursor-not-allowed disabled:text-white/35"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 3: new password ──────────────────────────────────────── */}
      {step === 'password' && (
        <form onSubmit={submitPassword} className="space-y-4">
          <div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <PasswordInput
              ref={passwordRef}
              id="new-password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-2 text-xs text-white/45">At least {MIN_PASSWORD} characters.</p>
          </div>

          <div>
            <label className="label" htmlFor="confirm-password">
              Confirm new password
            </label>
            <PasswordInput
              id="confirm-password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </button>

          <p className="text-xs text-white/45">
            Updating your password signs you out on every device.
          </p>
        </form>
      )}

      {/* ── Done ──────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto h-11 w-11 text-accent-400" aria-hidden />
          <p className="text-sm text-white/65">
            Your password was changed and every existing session was signed out.
          </p>
          <button type="button" className="btn-primary w-full" onClick={() => navigate('/login')}>
            Back to login
          </button>
        </div>
      )}

      {step !== 'done' && (
        <>
          <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-wider text-white/30">
            <span className="h-px flex-1 bg-white/10" />
            Remembered it?
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <Link to="/login" className="btn-ghost mt-4 w-full">
            Back to login
          </Link>
        </>
      )}
    </AuthShell>
  );
}
