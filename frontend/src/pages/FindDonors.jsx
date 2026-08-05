import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  MapPin,
  Hospital,
  Car,
  Droplet,
  CheckCircle2,
  Clock,
  Bell,
  Star,
  Handshake,
  MessageSquare,
} from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

// Leaflet is sizeable; load the map chunk on demand.
const DonorMap = lazy(() => import('../components/DonorMap.jsx'));

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RADII = [5, 10, 20, 50];

export default function FindDonors() {
  const navigate = useNavigate();
  const [params, setParams] = useState(null);

  // Start (or open) a conversation with a donor, then jump into the thread.
  const startChat = useMutation({
    mutationFn: (donorId) => unwrap(api.post('/chat/conversations', { peerId: donorId })),
    onSuccess: (d) => navigate(`/dashboard/messages/${d.conversation.id || d.conversation._id}`),
  });
  const [form, setForm] = useState({ bloodGroup: 'O+', lng: '', lat: '', radiusKm: 10 });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        lat: pos.coords.latitude.toFixed(6),
        lng: pos.coords.longitude.toFixed(6),
      }));
    });
  };

  // Clicking the map sets the search center.
  const onPick = ({ lat, lng }) =>
    setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));

  const { data, isFetching, error } = useQuery({
    queryKey: ['donors', params],
    enabled: !!params,
    queryFn: () => unwrap(api.get('/requests/donors/search', { params })),
  });

  // Donor Radar: counts of available compatible donors per distance ring.
  const { data: radar } = useQuery({
    queryKey: ['radar', params],
    enabled: !!params,
    queryFn: () => unwrap(api.get('/requests/donors/radar', { params })),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    setParams({
      bloodGroup: form.bloodGroup,
      lng: Number(form.lng),
      lat: Number(form.lat),
      radiusKm: Number(form.radiusKm),
    });
  };

  // Meetup invite: suggest a hospital halfway between the two, with ETAs,
  // and push a real-time notification to the donor.
  const [meetup, setMeetup] = useState(null);
  const invite = useMutation({
    mutationFn: (donorId) =>
      unwrap(
        api.post('/meetups', {
          donorId,
          lng: Number(form.lng),
          lat: Number(form.lat),
          bloodGroup: form.bloodGroup,
        })
      ),
    onSuccess: (d) => setMeetup(d.meetup),
  });

  // Flip the banner live when the invited donor responds.
  useEffect(() => {
    if (!meetup) return;
    const socket = getSocket();
    const onResponse = (p) => {
      if (p.meetupId === meetup._id) {
        setMeetup((m) => ({ ...m, status: p.accepted ? 'accepted' : 'declined' }));
      }
    };
    socket.on('meetup:response', onResponse);
    return () => socket.off('meetup:response', onResponse);
  }, [meetup?._id]);

  const donors = data?.donors || [];
  const hasCenter = form.lat !== '' && form.lng !== '';
  const center = hasCenter ? [Number(form.lat), Number(form.lng)] : null;

  return (
    <div className="space-y-6">
      <div className="reveal">
        <h1 className="text-3xl font-bold">Find <span className="text-gradient">compatible donors</span></h1>
        <p className="mt-1 text-white/50">
          Click the map to set a location, or use your own. Ranked by compatibility, distance, and reputation.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card grid grid-cols-1 gap-4 sm:grid-cols-4">
        <label className="block">
          <span className="label">Patient blood group</span>
          <select className="input" value={form.bloodGroup} onChange={set('bloodGroup')}>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Longitude</span>
          <input className="input" required value={form.lng} onChange={set('lng')} placeholder="click map →" />
        </label>
        <label className="block">
          <span className="label">Latitude</span>
          <input className="input" required value={form.lat} onChange={set('lat')} placeholder="click map →" />
        </label>
        <label className="block">
          <span className="label">Radius (km)</span>
          <select className="input" value={form.radiusKm} onChange={set('radiusKm')}>
            {RADII.map((r) => <option key={r} value={r}>{r} km</option>)}
          </select>
        </label>
        <div className="flex gap-3 sm:col-span-4">
          <button type="button" onClick={useMyLocation} className="btn-ghost"><MapPin className="h-4 w-4" aria-hidden /> Use my location</button>
          <button type="submit" className="btn-primary" disabled={!hasCenter}>Search</button>
        </div>
      </form>

      {/* Map */}
      <Suspense
        fallback={
          <div className="flex h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/40">
            Loading map…
          </div>
        }
      >
        <DonorMap
          center={center}
          radiusKm={Number(form.radiusKm)}
          donors={donors}
          onPick={onPick}
        />
      </Suspense>

      {/* Donor Radar ring counts */}
      {radar?.rings && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {radar.rings.map((ring) => (
            <div key={ring.radiusKm} className="card card-hover py-4 text-center">
              <div className="text-2xl font-extrabold text-gradient">{ring.count}</div>
              <div className="mt-1 text-xs text-white/50">within {ring.radiusKm} km</div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-brand-300">{error.message}</p>}
      {isFetching && <p className="text-white/50">Searching…</p>}

      {/* Meetup suggestion banner */}
      {invite.isError && <p className="text-brand-300">{invite.error.message}</p>}
      {meetup && (
        <div
          className={`card border ${
            meetup.status === 'accepted'
              ? 'border-emerald-500/40'
              : meetup.status === 'declined'
                ? 'border-white/20'
                : 'border-brand-500/40'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-wider text-white/40">
                Suggested meeting point
              </div>
              <div className="mt-1 flex items-center gap-2 text-xl font-bold"><Hospital className="h-5 w-5 text-brand-400" aria-hidden /> {meetup.hospital.name}</div>
              {meetup.hospital.address && (
                <div className="text-sm text-white/50">{meetup.hospital.address}</div>
              )}
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-1.5"><Car className="h-4 w-4 text-white/50" aria-hidden /> You can reach it in <strong>~{meetup.etaRecipientMin} min</strong> ({meetup.distanceRecipientKm} km)</div>
                <div className="flex items-center gap-1.5"><Droplet className="h-4 w-4 text-brand-400" fill="currentColor" aria-hidden /> The donor can reach it in <strong>~{meetup.etaDonorMin} min</strong> ({meetup.distanceDonorKm} km)</div>
                {meetup.etaEstimated && (
                  <div className="text-xs text-white/40">Times are straight-line estimates (routing service unavailable).</div>
                )}
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                meetup.status === 'accepted'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : meetup.status === 'declined'
                    ? 'bg-white/10 text-white/50'
                    : 'animate-pulse bg-brand-500/20 text-brand-300'
              }`}
            >
              {meetup.status === 'accepted' ? (
                <><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Donor accepted</>
              ) : meetup.status === 'declined' ? (
                'Donor declined'
              ) : (
                <><Clock className="h-3.5 w-3.5" aria-hidden /> Waiting for donor…</>
              )}
            </span>
          </div>
        </div>
      )}

      {data && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-white/50">
              {data.count} compatible donor(s) found within {form.radiusKm} km
            </p>
            {donors.length > 0 && (
              <button
                type="button"
                className="btn-primary"
                disabled={invite.isPending}
                onClick={() => invite.mutate(donors[0].id)}
              >
                {invite.isPending ? 'Sending…' : (<><Bell className="h-4 w-4" aria-hidden /> Notify best donor</>)}
              </button>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {donors.map((d, i) => (
              <li key={d.id} className="card card-hover flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white/90">
                    {d.fullName}
                    {i === 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                        <Star className="h-3 w-3" fill="currentColor" aria-hidden /> Best match
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white/50">
                    {d.city}{d.state ? `, ${d.state}` : ''} · {d.distanceKm} km away
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-white/40">
                    <Star className="h-3 w-3 text-amber-400" fill="currentColor" aria-hidden /> {d.reputationScore} · {d.donationCount} donations
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
                      disabled={invite.isPending}
                      onClick={() => invite.mutate(d.id)}
                    >
                      <Handshake className="h-3.5 w-3.5" aria-hidden /> Suggest meetup
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
                      disabled={startChat.isPending}
                      onClick={() => startChat.mutate(d.id)}
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Message
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 text-sm font-bold text-brand-300">
                    {d.bloodGroup}
                  </span>
                  <div className={`mt-2 text-xs font-medium ${d.eligible ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {d.eligible ? 'Eligible' : 'Not eligible'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
