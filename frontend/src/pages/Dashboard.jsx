import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Droplet,
  ClipboardList,
  Heart,
  Plus,
  Search,
  MapPin,
  Car,
  Check,
  X,
  CheckCircle2,
  Hospital,
} from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import AvailabilityCard from '../components/AvailabilityCard.jsx';
import BadgeShelf from '../components/BadgeShelf.jsx';

const statusColor = {
  active: 'bg-accent-500/15 text-accent-300',
  accepted: 'bg-sky-500/15 text-sky-300',
  in_progress: 'bg-amber-500/15 text-amber-300',
  fulfilled: 'bg-brand-500/15 text-brand-300',
  expired: 'bg-white/10 text-white/50',
  cancelled: 'bg-white/10 text-white/50',
};

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: mine } = useQuery({
    queryKey: ['requests', 'mine'],
    queryFn: () => unwrap(api.get('/requests/mine')),
  });
  const { data: meetupData } = useQuery({
    queryKey: ['meetups'],
    queryFn: () => unwrap(api.get('/meetups/mine')),
  });

  const respond = useMutation({
    mutationFn: ({ id, accept }) => unwrap(api.post(`/meetups/${id}/respond`, { accept })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetups'] }),
  });
  const confirmDonation = useMutation({
    mutationFn: ({ requestId, donorId }) =>
      unwrap(api.post(`/requests/${requestId}/donations/${donorId}/complete`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['requests'] }),
  });

  const requests = mine?.requests || [];
  const meetups = meetupData?.meetups || [];
  const myId = String(user?.id || user?._id || '');
  const isDonorSide = (m) => String(m.donor?._id || m.donor) === myId;
  const incoming = meetups.filter((m) => isDonorSide(m) && m.status === 'pending');
  const others = meetups.filter((m) => !(isDonorSide(m) && m.status === 'pending'));

  return (
    <div className="space-y-8">
      <header className="reveal">
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome back, <span className="text-gradient">{user?.fullName?.split(' ')[0]}</span>
        </h1>
        <p className="mt-1.5 text-white/50">Here's what's happening on VeinReach.</p>
      </header>

      <AvailabilityCard />
      {user?.role === 'donor' && <BadgeShelf profile={user.donorProfile} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Your blood group" value={user?.bloodGroup} icon={Droplet} tint="bg-brand-600/20 text-brand-300" />
        <Stat label="Your requests" value={requests.length} icon={ClipboardList} tint="bg-accent-500/20 text-accent-300" />
        <Stat label="Donations made" value={user?.donorProfile?.donationCount ?? 0} icon={Heart} tint="bg-rose-500/20 text-rose-300" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/dashboard/requests/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> Create blood request</Link>
        <Link to="/dashboard/donors" className="btn-ghost"><Search className="h-4 w-4" aria-hidden /> Find nearby donors</Link>
      </div>

      {incoming.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-brand-400" aria-hidden /> Meetup invites for you</h2>
          <ul className="space-y-3">
            {incoming.map((m) => (
              <li key={m._id} className="card border-brand-500/30">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">
                      {m.recipient?.fullName || 'A recipient'} needs{' '}
                      <span className="text-brand-300">{m.bloodGroup}</span> blood
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-white/60">
                      <Hospital className="h-4 w-4" aria-hidden /> {m.hospital?.name}
                      {m.hospital?.address ? ` — ${m.hospital.address}` : ''}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-white/60">
                      <Car className="h-4 w-4" aria-hidden /> ~<strong>{m.etaDonorMin} min</strong> away
                      {m.distanceDonorKm ? ` (${m.distanceDonorKm} km)` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={respond.isPending} onClick={() => respond.mutate({ id: m._id, accept: true })}>
                      <Check className="h-4 w-4" aria-hidden /> Accept
                    </button>
                    <button className="btn-ghost" disabled={respond.isPending} onClick={() => respond.mutate({ id: m._id, accept: false })}>
                      <X className="h-4 w-4" aria-hidden /> Decline
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Your meetups</h2>
          <ul className="space-y-2">
            {others.slice(0, 5).map((m) => (
              <li key={m._id} className="card flex items-center justify-between py-4">
                <div className="flex items-center gap-1.5 text-sm text-white/80">
                  <Hospital className="h-4 w-4 text-white/40" aria-hidden />
                  <span className="font-medium">{isDonorSide(m) ? m.recipient?.fullName : m.donor?.fullName}</span>
                  <span className="text-white/40">· {m.hospital?.name} · ~{isDonorSide(m) ? m.etaDonorMin : m.etaRecipientMin} min</span>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColor[m.status] || 'bg-white/10 text-white/50'}`}>
                  {m.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your recent requests</h2>
        {requests.length === 0 ? (
          <div className="card flex items-center gap-3 text-sm text-white/50">
            <ClipboardList className="h-5 w-5 text-white/30" aria-hidden />
            No requests yet.{' '}
            <Link to="/dashboard/requests/new" className="font-medium text-brand-300 hover:underline">Create one</Link>.
          </div>
        ) : (
          <ul className="space-y-2">
            {requests.slice(0, 5).map((r) => (
              <li key={r._id} className="card card-hover py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 text-sm font-bold text-brand-300">{r.bloodGroup}</span>
                    <span className="text-sm text-white/80">{r.hospitalName}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusColor[r.status] || 'bg-white/10 text-white/60'}`}>
                    {r.status?.replace('_', ' ')}
                  </span>
                </div>

                {r.acceptedDonors?.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    {r.acceptedDonors.map((a) => {
                      const donorId = a.donor?._id || a.donor;
                      return (
                        <li key={donorId} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-white/70">
                            {a.donor?.fullName || 'Donor'}
                            {a.donor?.bloodGroup && (
                              <span className="ml-2 rounded-md bg-brand-600/25 px-1.5 py-0.5 text-xs font-bold text-brand-300">{a.donor.bloodGroup}</span>
                            )}
                          </span>
                          {a.verified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent-500/15 px-2.5 py-1 text-xs font-medium text-accent-300">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Donated
                            </span>
                          ) : (
                            <button className="btn-ghost px-3 py-1.5 text-xs" disabled={confirmDonation.isPending} onClick={() => confirmDonation.mutate({ requestId: r._id, donorId })}>
                              Confirm donation
                            </button>
                          )}
                        </li>
                      );
                    })}
                    {confirmDonation.isError && <li className="text-xs text-brand-300">{confirmDonation.error.message}</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tint }) {
  return (
    <div className="card card-hover">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="mt-3 text-3xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-0.5 text-sm text-white/50">{label}</div>
    </div>
  );
}
