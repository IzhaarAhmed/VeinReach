import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { friendlyError } from '../lib/api.js';
import AuthShell from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
// Only these are self-service; hospital/bloodbank require admin verification
// and are rejected by the backend at registration.
const ROLES = ['donor', 'recipient'];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', mobile: '', password: '',
    bloodGroup: 'O+', gender: 'male', dateOfBirth: '', weight: '',
    city: '', state: '', emergencyContact: '', role: 'donor',
  });
  // Consent is tracked separately from the profile fields: it is not profile
  // data, and it must start false so registering is an affirmative act.
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({
        ...form,
        weight: Number(form.weight),
        acceptPrivacy,
        // Optionally attach geolocation later; backend accepts location.coordinates.
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(friendlyError(err, 'Registration failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Join VeinReach" subtitle="Create your account in under two minutes" wide>
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-brand-500/30 bg-brand-600/15 p-3 text-sm text-brand-200">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name"><input className="input" required value={form.fullName} onChange={set('fullName')} /></Field>
        <Field label="Email"><input type="email" className="input" required value={form.email} onChange={set('email')} /></Field>
        <Field label="Mobile"><input className="input" required value={form.mobile} onChange={set('mobile')} /></Field>
        <Field label="Password"><PasswordInput required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>

        <Field label="Blood group">
          <select className="input" value={form.bloodGroup} onChange={set('bloodGroup')}>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Gender">
          <select className="input" value={form.gender} onChange={set('gender')}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </Field>

        <Field label="Date of birth"><input type="date" className="input" required value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
        <Field label="Weight (kg)"><input type="number" className="input" required value={form.weight} onChange={set('weight')} /></Field>

        <Field label="City"><input className="input" value={form.city} onChange={set('city')} /></Field>
        <Field label="State"><input className="input" value={form.state} onChange={set('state')} /></Field>

        <Field label="Emergency contact"><input className="input" value={form.emergencyContact} onChange={set('emergencyContact')} /></Field>
        <Field label="Account type">
          <select className="input" value={form.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        {/* Unticked by default and never pre-checked: consent to health-data
            processing has to be an affirmative act, and the backend rejects a
            registration whose acceptPrivacy is anything but literal true. */}
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <input
              type="checkbox"
              required
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/10 accent-brand-500"
            />
            <span className="text-sm leading-relaxed text-white/65">
              I have read and accept the{' '}
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-400 underline decoration-brand-500/40 underline-offset-2 hover:text-brand-300"
              >
                Privacy Policy
              </Link>
              . I understand VeinReach stores my blood group and location to match me with
              nearby requests, and that I can download or erase my data at any time.
            </span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary w-full" disabled={busy || !acceptPrivacy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300 hover:underline">Login</Link>
      </p>
    </AuthShell>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
