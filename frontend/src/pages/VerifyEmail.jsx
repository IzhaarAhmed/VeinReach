import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Landing page for the verification link emailed at registration:
 * /verify-email?email=...&token=...
 */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  const started = useRef(false); // StrictMode double-mount guard

  const email = params.get('email');
  const token = params.get('token');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!email || !token) {
      setState('error');
      setMessage('This verification link is incomplete. Use the link from your email.');
      return;
    }

    (async () => {
      try {
        await unwrap(api.post('/auth/verify-email', { email, token }));
        setState('success');
        if (user) await refreshUser().catch(() => {});
      } catch (err) {
        setState('error');
        setMessage(err.message);
      }
    })();
  }, [email, token, user, refreshUser]);

  return (
    <div className="app-bg flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md text-center">
        <div className="flex justify-center" aria-hidden>
          {state === 'verifying' ? (
            <Loader2 className="h-11 w-11 animate-spin text-accent-400" />
          ) : state === 'success' ? (
            <CheckCircle2 className="h-11 w-11 text-accent-400" />
          ) : (
            <AlertTriangle className="h-11 w-11 text-amber-400" />
          )}
        </div>
        <h1 className="mt-3 text-2xl font-bold">
          {state === 'verifying'
            ? 'Verifying your email…'
            : state === 'success'
              ? 'Email verified!'
              : 'Verification failed'}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          {state === 'verifying'
            ? 'One moment.'
            : state === 'success'
              ? 'Your account is active — you can now create blood requests and accept donations.'
              : message}
        </p>
        {state !== 'verifying' && (
          <Link to={user ? '/dashboard' : '/login'} className="btn-primary mt-6 inline-flex">
            {user ? 'Go to dashboard' : 'Log in'}
          </Link>
        )}
      </div>
    </div>
  );
}
