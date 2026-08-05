import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import HospitalSearch from '../components/HospitalSearch.jsx';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function CreateRequest() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    bloodGroup: 'O+', unitsRequired: 1, hospitalName: '', hospitalAddress: '',
    urgency: 'normal', notes: '', lng: '', lat: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
      }));
    });
  };

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.post('/requests', {
          bloodGroup: form.bloodGroup,
          unitsRequired: Number(form.unitsRequired),
          hospitalName: form.hospitalName,
          hospitalAddress: form.hospitalAddress || undefined,
          urgency: form.urgency,
          notes: form.notes || undefined,
          hospitalLocation: { coordinates: [Number(form.lng), Number(form.lat)] },
        })
      ),
    onSuccess: () => navigate('/dashboard/requests'),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="reveal mb-6">
        <h1 className="text-3xl font-bold">Create a <span className="text-gradient">blood request</span></h1>
        <p className="mt-1 text-white/50">Compatible donors nearby will be notified.</p>
      </div>

      {create.isError && (
        <div role="alert" className="mb-4 rounded-xl border border-brand-500/30 bg-brand-600/15 p-3 text-sm text-brand-200">
          {create.error.message}
        </div>
      )}

      <form onSubmit={onSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Blood group needed">
          <select className="input" value={form.bloodGroup} onChange={set('bloodGroup')}>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Units required">
          <input type="number" min="1" className="input" value={form.unitsRequired} onChange={set('unitsRequired')} />
        </Field>

        <Field label="Hospital name" full>
          <HospitalSearch
            value={form.hospitalName}
            onChange={set('hospitalName')}
            bias={form.lat && form.lng ? { lat: form.lat, lng: form.lng } : null}
            onSelect={(h) =>
              setForm((f) => ({
                ...f,
                hospitalName: h.name,
                hospitalAddress: h.address,
                lng: h.lng.toFixed(6),
                lat: h.lat.toFixed(6),
              }))
            }
          />
          <span className="mt-1 block text-xs text-white/40">
            Pick a suggestion to fill the address and map location automatically.
          </span>
        </Field>
        <Field label="Hospital address" full>
          <input className="input" value={form.hospitalAddress} onChange={set('hospitalAddress')} />
        </Field>

        <Field label="Longitude">
          <input className="input" required value={form.lng} onChange={set('lng')} placeholder="e.g. 77.5946" />
        </Field>
        <Field label="Latitude">
          <input className="input" required value={form.lat} onChange={set('lat')} placeholder="e.g. 12.9716" />
        </Field>

        <div className="sm:col-span-2">
          <button type="button" onClick={useMyLocation} className="btn-ghost">
            <MapPin className="h-4 w-4" aria-hidden /> Use my current location
          </button>
        </div>

        <Field label="Urgency">
          <select className="input" value={form.urgency} onChange={set('urgency')}>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
          </select>
        </Field>

        <Field label="Notes" full>
          <textarea className="input" rows="3" value={form.notes} onChange={set('notes')} />
        </Field>

        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary w-full" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create request'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
