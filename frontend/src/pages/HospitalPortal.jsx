import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, MapPin, Star, Droplet, ClipboardList, CheckCircle2, Heart, Zap } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { getPosition } from '../lib/geo.js';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function HospitalPortal() {
  return (
    <div className="space-y-6">
      <div className="reveal flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Hospital <span className="text-gradient">portal</span></h1>
          <p className="mt-1 text-white/50">Track your requests, verified donations, and find donors.</p>
        </div>
        <Link to="/dashboard/requests/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> New emergency request</Link>
      </div>

      <StatsSection />
      <NearbyDonors />
      <VerifiedDonations />
    </div>
  );
}

function StatsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['hospital-stats'],
    queryFn: () => unwrap(api.get('/hospital/stats')),
  });
  if (isLoading) return <p className="text-white/50">Loading analytics…</p>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Requests created" value={data.requests?.total ?? 0} icon={ClipboardList} tint="bg-accent-500/20 text-accent-300" />
      <Stat label="Fulfillment rate" value={data.requests?.fulfillmentRatePct != null ? `${data.requests.fulfillmentRatePct}%` : '—'} icon={CheckCircle2} tint="bg-emerald-500/20 text-emerald-300" />
      <Stat label="Donations verified" value={data.donationsVerified ?? 0} icon={Heart} tint="bg-rose-500/20 text-rose-300" />
      <Stat label="Avg. response" value={data.responsiveness?.avgFirstResponseMinutes != null ? `${data.responsiveness.avgFirstResponseMinutes}m` : '—'} icon={Zap} tint="bg-amber-500/20 text-amber-300" />
    </div>
  );
}

function NearbyDonors() {
  const [form, setForm] = useState({ bloodGroup: 'O+', lng: '', lat: '', radiusKm: 10 });
  const [params, setParams] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const useMyLocation = async () => {
    try {
      const [lng, lat] = await getPosition();
      setForm((f) => ({ ...f, lng: lng.toFixed(6), lat: lat.toFixed(6) }));
    } catch { /* ignore */ }
  };

  const { data, isFetching, error } = useQuery({
    queryKey: ['hospital-donors', params],
    enabled: !!params,
    queryFn: () => unwrap(api.get('/hospital/donors', { params })),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    setParams({ bloodGroup: form.bloodGroup, lng: Number(form.lng), lat: Number(form.lat), radiusKm: Number(form.radiusKm) });
  };

  const donors = data?.donors || [];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Find nearby donors</h2>
      <form onSubmit={onSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label className="block">
          <span className="label">Blood group</span>
          <select className="input" value={form.bloodGroup} onChange={set('bloodGroup')}>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Longitude</span>
          <input className="input" required value={form.lng} onChange={set('lng')} />
        </label>
        <label className="block">
          <span className="label">Latitude</span>
          <input className="input" required value={form.lat} onChange={set('lat')} />
        </label>
        <label className="block">
          <span className="label">Radius (km)</span>
          <input className="input" type="number" min="1" max="500" value={form.radiusKm} onChange={set('radiusKm')} />
        </label>
        <div className="flex gap-3 sm:col-span-4">
          <button type="button" className="btn-ghost" onClick={useMyLocation}><MapPin className="h-4 w-4" aria-hidden /> Use my location</button>
          <button type="submit" className="btn-primary" disabled={form.lat === '' || form.lng === ''}>Search</button>
        </div>
      </form>
      {error && <p className="text-brand-300">{error.message}</p>}
      {isFetching && <p className="text-white/50">Searching…</p>}
      {donors.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {donors.map((d) => (
            <li key={d.id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold text-white/90">{d.fullName}</div>
                <div className="text-sm text-white/50">{d.city}{d.state ? `, ${d.state}` : ''} · {d.distanceKm} km</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-white/40"><Star className="h-3 w-3 text-amber-400" fill="currentColor" aria-hidden /> {d.reputationScore} · {d.donationCount} donations</div>
              </div>
              <div className="text-right">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 text-sm font-bold text-brand-300">{d.bloodGroup}</span>
                <div className={`mt-2 text-xs font-medium ${d.eligible ? 'text-emerald-400' : 'text-amber-400'}`}>{d.eligible ? 'Eligible' : 'Not eligible'}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VerifiedDonations() {
  const { data, isLoading } = useQuery({
    queryKey: ['hospital-donations'],
    queryFn: () => unwrap(api.get('/hospital/donations')),
  });
  if (isLoading) return null;
  const donations = data?.donations || [];

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Donations you verified</h2>
      {donations.length === 0 ? (
        <div className="card text-white/50">No verified donations yet.</div>
      ) : (
        <ul className="space-y-2">
          {donations.map((d) => (
            <li key={d._id} className="card flex items-center justify-between py-4 text-sm">
              <span className="flex items-center gap-1.5">
                <Droplet className="h-4 w-4 text-brand-400" fill="currentColor" aria-hidden />
                <strong>{d.bloodGroup}</strong> · {d.donor?.fullName || 'Donor'} → {d.recipient?.fullName || 'Recipient'}
              </span>
              <span className="text-white/40">{new Date(d.verifiedAt || d.createdAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value, icon: Icon, tint = 'bg-white/5 text-white/60' }) {
  return (
    <div className="card card-hover">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="mt-3 text-3xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-0.5 text-sm text-white/50">{label}</div>
    </div>
  );
}
