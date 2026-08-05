import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { friendlyError } from '../lib/api.js';
import LuxAuthShell from '../components/LuxAuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyError(err, 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LuxAuthShell eyebrow="Sign in" title="Welcome back." subtitle="Pick up where you left off.">
      {error && (
        <div role="alert" className="lux-alert">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate={false}>
        <div className="lux-field">
          <label className="lux-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="lux-input"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="lux-field">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label className="lux-label mb-0" htmlFor="password">
              Password
            </label>
            <Link to="/forgot-password" className="lux-link">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            className="lux-input"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="lux-btn lux-btn--primary mt-7" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
          {!busy && <ArrowRight className="lux-btn__icon h-4 w-4" aria-hidden="true" />}
        </button>
      </form>

      <div className="lux-divider">New to VeinReach?</div>

      <Link to="/register" className="lux-btn lux-btn--ghost">
        Create an account
      </Link>
    </LuxAuthShell>
  );
}
