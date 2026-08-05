import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Droplet, CheckCircle2, FileText } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { uploadFile } from '../lib/upload.js';
import { useAuth } from '../context/AuthContext.jsx';
import BadgeShelf from '../components/BadgeShelf.jsx';

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
