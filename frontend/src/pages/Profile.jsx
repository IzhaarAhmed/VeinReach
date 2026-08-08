import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Droplet, CheckCircle2, FileText, Download, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api, unwrap, friendlyError } from '../lib/api.js';
import { uploadFile } from '../lib/upload.js';
import { useAuth } from '../context/AuthContext.jsx';
import BadgeShelf from '../components/BadgeShelf.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

const ORG_ROLES = ['hospital', 'bloodbank'];
const DOC_TYPES = [
  { value: 'id_proof', label: 'ID proof' },
  { value: 'medical', label: 'Medical document' },
  { value: 'hospital_license', label: 'Hospital license' },
  { value: 'bloodbank_license', label: 'Blood bank license' },
  { value: 'other', label: 'Other' },
];

export default function Profile() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div className="reveal">
        <h1 className="text-3xl font-bold">Your <span className="text-gradient">profile</span></h1>
        <p className="mt-1 text-white/50">Manage your photo, verification, and details.</p>
      </div>
      <AvatarCard user={user} />
      {user?.role === 'donor' && <BadgeShelf profile={user.donorProfile} />}
      <VerificationCard user={user} />
      <DetailsCard user={user} />
      <DocumentsCard user={user} />
      <PrivacyCard />
    </div>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */
function AvatarCard({ user }) {
  const { refreshUser } = useAuth();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');

  const upload = useMutation({
    mutationFn: async (file) => {
      const { key } = await uploadFile(file, 'profile_image');
      return unwrap(api.put('/users/me/avatar', { key }));
    },
    onSuccess: async () => {
      setMsg('Photo updated.');
      await refreshUser();
    },
    onError: (e) => setMsg(e.message),
  });

  return (
    <div className="card flex items-center gap-5">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 text-2xl">
        {user?.avatar?.url ? (
          <img src={user.avatar.url} alt="Your profile" className="h-full w-full object-cover" />
        ) : (
          <Droplet className="h-8 w-8 text-brand-400" fill="currentColor" aria-hidden />
        )}
      </div>
      <div className="flex-1">
        <div className="font-semibold">Profile photo</div>
        <p className="text-sm text-white/50">PNG, JPG or WebP. Shown to donors and recipients you connect with.</p>
        {msg && <p className="mt-1 text-xs text-brand-300">{msg}</p>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
      />
      <button className="btn-ghost" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
        {upload.isPending ? 'Uploading…' : 'Change photo'}
      </button>
    </div>
  );
}

/* ── Email + mobile verification ────────────────────────────────────────── */
function VerificationCard({ user }) {
  const { refreshUser } = useAuth();
  const emailVerified = user?.verification?.emailVerified;
  const mobileVerified = user?.verification?.mobileVerified;
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');

  const sendOtp = useMutation({
    mutationFn: () => unwrap(api.post('/auth/send-otp')),
    onSuccess: () => { setSent(true); setMsg('Code sent to your mobile.'); },
    onError: (e) => setMsg(e.message),
  });
  const verifyOtp = useMutation({
    mutationFn: () => unwrap(api.post('/auth/verify-otp', { code })),
    onSuccess: async () => { setMsg('Mobile verified!'); await refreshUser(); },
    onError: (e) => setMsg(e.message),
  });

  return (
    <div className="card space-y-4">
      <div className="font-semibold">Account verification</div>

      <Row label="Email" value={user?.email} verified={emailVerified} />

      <div className="border-t border-white/10 pt-4">
        <Row label="Mobile" value={user?.mobile} verified={mobileVerified} />
        {!mobileVerified && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {!sent ? (
              <button className="btn-ghost" disabled={sendOtp.isPending} onClick={() => sendOtp.mutate()}>
                {sendOtp.isPending ? 'Sending…' : 'Send verification code'}
              </button>
            ) : (
              <>
                <label className="block">
                  <span className="label">Enter the 6-digit code</span>
                  <input
                    className="input w-40"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                  />
                </label>
                <button className="btn-primary" disabled={verifyOtp.isPending || code.length < 4} onClick={() => verifyOtp.mutate()}>
                  {verifyOtp.isPending ? 'Verifying…' : 'Verify'}
                </button>
                <button className="btn-ghost" disabled={sendOtp.isPending} onClick={() => sendOtp.mutate()}>
                  Resend
                </button>
              </>
            )}
          </div>
        )}
        {msg && <p className="mt-2 text-xs text-brand-300">{msg}</p>}
      </div>
    </div>
  );
}

function Row({ label, value, verified }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm text-white/50">{label}</div>
        <div className="text-white/90">{value}</div>
      </div>
      <span className={`badge ${verified ? 'border-emerald-500/40 text-emerald-300' : 'border-amber-500/40 text-amber-300'}`}>
        {verified ? <><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Verified</> : 'Unverified'}
      </span>
    </div>
  );
}

/* ── Editable details ───────────────────────────────────────────────────── */
function DetailsCard({ user }) {
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    city: user?.city || '',
    state: user?.state || '',
    emergencyContact: user?.emergencyContact || '',
    weight: user?.weight || '',
  });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form };
      if (body.weight === '') delete body.weight;
      else body.weight = Number(body.weight);
      return unwrap(api.patch('/users/me', body));
    },
    onSuccess: async () => { setMsg('Saved.'); await refreshUser(); },
    onError: (e) => setMsg(e.message),
  });

  return (
    <form
      className="card grid grid-cols-1 gap-4 sm:grid-cols-2"
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
    >
      <div className="sm:col-span-2 font-semibold">Personal details</div>
      <Field label="Full name" value={form.fullName} onChange={set('fullName')} />
      <Field label="Weight (kg)" value={form.weight} onChange={set('weight')} type="number" />
      <Field label="City" value={form.city} onChange={set('city')} />
      <Field label="State" value={form.state} onChange={set('state')} />
      <Field label="Emergency contact" value={form.emergencyContact} onChange={set('emergencyContact')} />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</button>
        {msg && <span className="text-xs text-brand-300">{msg}</span>}
      </div>
    </form>
  );
}

function Field({ label, type = 'text', ...props }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" type={type} {...props} />
    </label>
  );
}

/* ── Your data: export + close account ──────────────────────────────────── */

/**
 * The two data-subject rights, self-service (DPDP §11 and §12). Both take
 * effect immediately — nobody should have to email support to leave.
 */
function PrivacyCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const exportData = useMutation({
    // The endpoint needs an Authorization header, so a plain link cannot fetch
    // it — pull the blob, then hand it to the browser as a download.
    mutationFn: async () => {
      const res = await api.get('/users/me/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = `veinreach-data-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    onSuccess: () => setMsg('Your data file has been downloaded.'),
    onError: (e) => setMsg(friendlyError(e, 'Could not prepare your data')),
  });

  const closeAccount = useMutation({
    mutationFn: () => unwrap(api.delete('/users/me', { data: { password, confirm } })),
    onSuccess: async () => {
      // The server already cleared the refresh cookie; this clears the in-memory
      // access token and the cached user so nothing keeps rendering as signed in.
      await logout();
      navigate('/', { replace: true });
    },
    onError: (e) => setMsg(friendlyError(e, 'Could not close your account')),
  });

  return (
    <div className="card space-y-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" aria-hidden />
        <div>
          <div className="font-semibold">Your data</div>
          <p className="text-sm text-white/50">
            Take a copy of everything we hold, or close your account and have it erased. See the{' '}
            <Link to="/privacy" className="text-brand-400 underline underline-offset-2 hover:text-brand-300">
              privacy policy
            </Link>{' '}
            for exactly what each one does.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <button className="btn-ghost" disabled={exportData.isPending} onClick={() => exportData.mutate()}>
          <Download className="h-4 w-4" aria-hidden />
          {exportData.isPending ? 'Preparing…' : 'Download my data'}
        </button>
        <span className="text-xs text-white/40">A JSON file, generated on the spot.</span>
      </div>

      <div className="border-t border-white/10 pt-4">
        {!confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn-ghost border-brand-500/40 text-brand-300 hover:border-brand-500/60"
              onClick={() => {
                setMsg('');
                setConfirming(true);
              }}
            >
              Close my account
            </button>
            <span className="text-xs text-white/40">This cannot be undone.</span>
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-brand-500/30 bg-brand-600/10 p-4">
            <div className="flex items-start gap-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden />
              <div className="text-sm text-white/75">
                <p className="font-semibold text-brand-200">This erases your personal data immediately.</p>
                <p className="mt-1.5 leading-relaxed">
                  Your name, contact details, location, photos and documents are deleted, along with
                  your chats — which also removes them for the people you were talking to. Your
                  donations stay on record as anonymous, so recipients and hospitals keep their own
                  history. Download your data first if you want a copy.
                </p>
              </div>
            </div>

            <label className="block">
              <span className="label">Confirm your password</span>
              <PasswordInput
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="label">
                Type <span className="font-mono text-brand-300">DELETE</span> to confirm
              </span>
              <input
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                className="btn-primary"
                disabled={closeAccount.isPending || !password || confirm !== 'DELETE'}
                onClick={() => closeAccount.mutate()}
              >
                {closeAccount.isPending ? 'Closing…' : 'Permanently close my account'}
              </button>
              <button
                className="btn-ghost"
                disabled={closeAccount.isPending}
                onClick={() => {
                  setConfirming(false);
                  setPassword('');
                  setConfirm('');
                  setMsg('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <p role="status" className="text-xs text-brand-300">
          {msg}
        </p>
      )}
    </div>
  );
}

/* ── Documents ──────────────────────────────────────────────────────────── */
function DocumentsCard({ user }) {
  const { refreshUser } = useAuth();
  const fileRef = useRef(null);
  const [docType, setDocType] = useState('id_proof');
  const [msg, setMsg] = useState('');
  const purpose = ORG_ROLES.includes(user?.role) ? 'hospital_doc' : 'verification_doc';

  const upload = useMutation({
    mutationFn: async (file) => {
      const { key } = await uploadFile(file, purpose);
      return unwrap(api.post('/users/me/documents', { key, docType }));
    },
    onSuccess: async () => { setMsg('Document uploaded for review.'); await refreshUser(); },
    onError: (e) => setMsg(e.message),
  });

  const docs = user?.documents || [];
  const statusTone = {
    verified: 'border-emerald-500/40 text-emerald-300',
    rejected: 'border-brand-500/40 text-brand-300',
    pending: 'border-amber-500/40 text-amber-300',
  };

  return (
    <div className="card space-y-4">
      <div>
        <div className="font-semibold">Verification documents</div>
        <p className="text-sm text-white/50">
          {ORG_ROLES.includes(user?.role)
            ? 'Upload your organization license so an admin can verify your account.'
            : 'Upload an ID or medical document to raise your verification status.'}
        </p>
      </div>

      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-1.5"><FileText className="h-4 w-4 text-white/40" aria-hidden /> {d.label || d.docType?.replace('_', ' ')}</span>
              <span className={`badge capitalize ${statusTone[d.status] || ''}`}>{d.status}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="label">Document type</span>
          <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
        />
        <button className="btn-ghost" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
          {upload.isPending ? 'Uploading…' : 'Upload document'}
        </button>
      </div>
      {msg && <p className="text-xs text-brand-300">{msg}</p>}
    </div>
  );
}
