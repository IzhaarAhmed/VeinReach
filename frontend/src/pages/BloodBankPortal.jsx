import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Siren, AlertTriangle } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { getPosition } from '../lib/geo.js';
import { useAuth } from '../context/AuthContext.jsx';
import { levelTone } from './BloodBanks.jsx';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const LEVELS = ['available', 'low', 'critical', 'out'];

export default function BloodBankPortal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const verified = user?.verification?.status === 'verified';

  const { data, isLoading } = useQuery({
    queryKey: ['my-stock'],
    queryFn: () => unwrap(api.get('/bloodbanks/me/stock')),
  });
  const stock = data?.stock;

  const [rows, setRows] = useState({});
  const [org, setOrg] = useState({ organizationName: '', address: '', lng: '', lat: '' });
  const [msg, setMsg] = useState('');

  // Hydrate the editor once the inventory loads.
  useEffect(() => {
    if (!stock) return;
    const byGroup = Object.fromEntries((stock.inventory || []).map((i) => [i.bloodGroup, i]));
    setRows(
      Object.fromEntries(
        BLOOD_GROUPS.map((g) => [g, { units: byGroup[g]?.units ?? 0, level: byGroup[g]?.level ?? 'available' }])
      )
    );
    setOrg({
      organizationName: stock.organizationName || '',
      address: stock.address || '',
      lng: stock.location?.coordinates?.[0] ?? '',
      lat: stock.location?.coordinates?.[1] ?? '',
    });
  }, [stock]);

  const useMyLocation = async () => {
    try {
      const [lng, lat] = await getPosition();
      setOrg((o) => ({ ...o, lng: lng.toFixed(6), lat: lat.toFixed(6) }));
    } catch (e) {
      setMsg(e.message);
    }
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        organizationName: org.organizationName || undefined,
        address: org.address || undefined,
        inventory: BLOOD_GROUPS.map((g) => ({
          bloodGroup: g,
          units: Number(rows[g]?.units || 0),
          level: rows[g]?.level,
        })),
      };
      if (org.lng !== '' && org.lat !== '')
        body.location = { coordinates: [Number(org.lng), Number(org.lat)] };
      return unwrap(api.put('/bloodbanks/me/stock', body));
    },
    onSuccess: () => { setMsg('Inventory published.'); qc.invalidateQueries({ queryKey: ['my-stock'] }); },
    onError: (e) => setMsg(e.message),
  });

  if (isLoading) return <p className="text-white/50">Loading inventory…</p>;

  return (
    <div className="space-y-6">
      <div className="reveal">
        <h1 className="text-3xl font-bold">Blood bank <span className="text-gradient">portal</span></h1>
        <p className="mt-1 text-white/50">Publish your stock and raise shortage alerts to nearby donors.</p>
      </div>

      {!verified && (
        <div className="card flex items-start gap-2.5 border-amber-500/40 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>
            Your organization isn't verified yet. Upload a license in your{' '}
            <a href="/dashboard/profile" className="underline">profile</a>; publishing unlocks after an admin approves it.
          </span>
        </div>
      )}

      {/* Org + location */}
      <div className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2 font-semibold">Organization</label>
        <label className="block">
          <span className="label">Name</span>
          <input className="input" value={org.organizationName} onChange={(e) => setOrg((o) => ({ ...o, organizationName: e.target.value }))} />
        </label>
        <label className="block">
          <span className="label">Address</span>
          <input className="input" value={org.address} onChange={(e) => setOrg((o) => ({ ...o, address: e.target.value }))} />
        </label>
        <label className="block">
          <span className="label">Longitude</span>
          <input className="input" value={org.lng} onChange={(e) => setOrg((o) => ({ ...o, lng: e.target.value }))} />
        </label>
        <label className="block">
          <span className="label">Latitude</span>
          <input className="input" value={org.lat} onChange={(e) => setOrg((o) => ({ ...o, lat: e.target.value }))} />
        </label>
        <div className="sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={useMyLocation}><MapPin className="h-4 w-4" aria-hidden /> Use my location</button>
        </div>
      </div>

      {/* Inventory grid */}
      <div className="card">
        <div className="mb-4 font-semibold">Inventory by blood group</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BLOOD_GROUPS.map((g) => (
            <div key={g} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/20 text-sm font-bold text-brand-300">{g}</span>
              <label className="block flex-1">
                <span className="label">Units</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={rows[g]?.units ?? 0}
                  onChange={(e) => setRows((r) => ({ ...r, [g]: { ...r[g], units: e.target.value } }))}
                />
              </label>
              <label className="block flex-1">
                <span className="label">Level</span>
                <select
                  className="input"
                  value={rows[g]?.level ?? 'available'}
                  onChange={(e) => setRows((r) => ({ ...r, [g]: { ...r[g], level: e.target.value } }))}
                >
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" disabled={save.isPending || !verified} onClick={() => save.mutate()}>
            {save.isPending ? 'Publishing…' : 'Publish inventory'}
          </button>
          {msg && <span className="text-xs text-brand-300">{msg}</span>}
        </div>
      </div>

      <ShortageCard verified={verified} />
    </div>
  );
}

function ShortageCard({ verified }) {
  const [form, setForm] = useState({ bloodGroup: 'O-', level: 'critical', radiusKm: 20, note: '' });
  const [result, setResult] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const publish = useMutation({
    mutationFn: () => unwrap(api.post('/bloodbanks/me/shortage', {
      bloodGroup: form.bloodGroup,
      level: form.level,
      radiusKm: Number(form.radiusKm),
      note: form.note || undefined,
    })),
    onSuccess: (d) => setResult(`Alert sent — ${d.alerted} nearby donor(s) notified.`),
    onError: (e) => setResult(e.message),
  });

  return (
    <div className="card space-y-4 border-brand-500/30">
      <div>
        <div className="flex items-center gap-2 font-semibold"><Siren className="h-4 w-4 text-brand-400" aria-hidden /> Publish a shortage alert</div>
        <p className="text-sm text-white/50">Broadcasts an emergency alert to compatible donors near your bank.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label className="block">
          <span className="label">Blood group</span>
          <select className="input" value={form.bloodGroup} onChange={set('bloodGroup')}>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Severity</span>
          <select className="input" value={form.level} onChange={set('level')}>
            {['low', 'critical', 'out'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Radius (km)</span>
          <input className="input" type="number" min="1" max="200" value={form.radiusKm} onChange={set('radiusKm')} />
        </label>
        <label className="block">
          <span className="label">Note (optional)</span>
          <input className="input" value={form.note} onChange={set('note')} placeholder="e.g. urgent surgery" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={publish.isPending || !verified} onClick={() => publish.mutate()}>
          {publish.isPending ? 'Broadcasting…' : 'Broadcast alert'}
        </button>
        {result && <span className={`text-xs ${levelTone.critical}`}>{result}</span>}
      </div>
    </div>
  );
}
