import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Landmark } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { getPosition } from '../lib/geo.js';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const levelTone = {
  available: 'border-emerald-500/40 text-emerald-300',
  low: 'border-amber-500/40 text-amber-300',
  critical: 'border-brand-500/50 text-brand-300',
  out: 'border-white/15 text-white/40',
};

export default function BloodBanks() {
  const [form, setForm] = useState({ lng: '', lat: '', radiusKm: 25, bloodGroup: '', shortagesOnly: false });
  const [params, setParams] = useState(null);
  const [locMsg, setLocMsg] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const useMyLocation = async () => {
    try {
      const [lng, lat] = await getPosition();
      setForm((f) => ({ ...f, lng: lng.toFixed(6), lat: lat.toFixed(6) }));
      setLocMsg('');
    } catch (e) {
      setLocMsg(e.message);
    }
  };

  const { data, isFetching, error } = useQuery({
    queryKey: ['bloodbanks', params],
    enabled: !!params,
    queryFn: () => unwrap(api.get('/bloodbanks/nearby', { params })),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    const p = { lng: Number(form.lng), lat: Number(form.lat), radiusKm: Number(form.radiusKm) };
    if (form.bloodGroup) p.bloodGroup = form.bloodGroup;
    if (form.shortagesOnly) p.shortagesOnly = true;
    setParams(p);
  };

  const banks = data?.banks || [];
  const hasCenter = form.lat !== '' && form.lng !== '';

  return (
    <div className="space-y-5">
      <div className="reveal">
        <h1 className="text-3xl font-bold">Nearby <span className="text-gradient">blood banks</span></h1>
        <p className="mt-1 text-white/50">Find published stock levels and shortages near you.</p>
      </div>

      <form onSubmit={onSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label className="block">
          <span className="label">Blood group</span>
          <select className="input" value={form.bloodGroup} onChange={set('bloodGroup')}>
            <option value="">Any</option>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Longitude</span>
          <input className="input" required value={form.lng} onChange={set('lng')} placeholder="use location →" />
        </label>
        <label className="block">
          <span className="label">Latitude</span>
          <input className="input" required value={form.lat} onChange={set('lat')} placeholder="use location →" />
        </label>
        <label className="block">
          <span className="label">Radius (km)</span>
          <input className="input" type="number" min="1" max="200" value={form.radiusKm} onChange={set('radiusKm')} />
        </label>
        <label className="flex items-center gap-2 text-sm text-white/70 sm:col-span-2">
          <input type="checkbox" checked={form.shortagesOnly} onChange={set('shortagesOnly')} />
          Show only banks with a shortage
        </label>
        <div className="flex gap-3 sm:col-span-2">
          <button type="button" onClick={useMyLocation} className="btn-ghost"><MapPin className="h-4 w-4" aria-hidden /> Use my location</button>
          <button type="submit" className="btn-primary" disabled={!hasCenter}>Search</button>
        </div>
      </form>

      {locMsg && <p className="text-xs text-brand-300">{locMsg}</p>}
      {error && <p className="text-brand-300">{error.message}</p>}
      {isFetching && <p className="text-white/50">Searching…</p>}

      {data && (
        <section className="space-y-3">
          <p className="text-sm text-white/50">{banks.length} blood bank(s) found</p>
          {banks.map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-white/90"><Landmark className="h-4 w-4 text-accent-300" aria-hidden /> {b.organizationName || 'Blood bank'}</div>
                  {b.address && <div className="text-xs text-white/40">{b.address}</div>}
                </div>
                <span className="badge">{b.distanceKm} km</span>
              </div>
              {b.inventory?.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.inventory.map((i) => (
                    <span key={i.bloodGroup} className={`badge capitalize ${levelTone[i.level] || ''}`}>
                      {i.bloodGroup}: {i.level}{i.units ? ` (${i.units}u)` : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-white/40">No published stock.</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
