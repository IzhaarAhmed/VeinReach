import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Hospital, ScrollText, Star } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const statusTone = {
  verified: 'border-emerald-500/40 text-emerald-300',
  no_show: 'border-brand-500/40 text-brand-300',
  rejected: 'border-white/20 text-white/50',
};

export default function Donations() {
  const { user } = useAuth();
  const myId = String(user?.id || user?._id || '');
  const { data, isLoading, error } = useQuery({
    queryKey: ['donations'],
    queryFn: () => unwrap(api.get('/donations')),
  });

  if (isLoading) return <p className="text-white/50">Loading donation history…</p>;
  if (error) return <p className="text-brand-300">{error.message}</p>;

  const donations = data?.donations || [];

  return (
    <div className="space-y-5">
      <div className="reveal">
        <h1 className="text-3xl font-bold">Donation <span className="text-gradient">history</span></h1>
        <p className="mt-1 text-white/50">Your donations given and received, with certificates and feedback.</p>
      </div>

      {donations.length === 0 ? (
        <div className="card text-white/50">No donations recorded yet.</div>
      ) : (
        <ul className="space-y-3">
          {donations.map((d) => (
            <DonationRow key={d._id} donation={d} myId={myId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DonationRow({ donation, myId }) {
  const qc = useQueryClient();
  const iAmDonor = String(donation.donor?._id || donation.donor) === myId;
  const peerName = iAmDonor ? donation.recipient?.fullName : donation.donor?.fullName;
  const alreadyGave = iAmDonor ? donation.donorFeedback : donation.recipientFeedback;
  const [certMsg, setCertMsg] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const cert = useMutation({
    mutationFn: () => unwrap(api.get(`/donations/${donation._id}/certificate`)),
    onSuccess: (d) => {
      if (d.url) window.open(d.url, '_blank', 'noopener');
      else setCertMsg('Certificate not available.');
    },
    onError: (e) => setCertMsg(e.message),
  });

  return (
    <li className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600/20 text-base font-bold text-brand-300">
            {donation.bloodGroup}
          </span>
          <div>
            <div className="font-semibold text-white/90">
              {iAmDonor ? 'You donated' : 'You received'}
              {peerName && <span className="text-white/50"> {iAmDonor ? 'to' : 'from'} {peerName}</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Hospital className="h-3.5 w-3.5" aria-hidden /> {donation.hospitalName} · {new Date(donation.verifiedAt || donation.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <span className={`badge capitalize ${statusTone[donation.status] || ''}`}>
          {donation.status?.replace('_', ' ')}
        </span>
      </div>

      {donation.status === 'verified' && (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
          <button className="btn-ghost text-sm" disabled={cert.isPending} onClick={() => cert.mutate()}>
            {cert.isPending ? 'Preparing…' : (<><ScrollText className="h-4 w-4" aria-hidden /> View certificate</>)}
          </button>
          {!alreadyGave ? (
            <button className="btn-ghost text-sm" onClick={() => setShowFeedback((s) => !s)}>
              <Star className="h-4 w-4" aria-hidden /> Leave feedback
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-white/40">You rated this {alreadyGave.rating}<Star className="h-3 w-3 text-amber-400" fill="currentColor" aria-hidden /></span>
          )}
          {certMsg && <span className="text-xs text-brand-300">{certMsg}</span>}
        </div>
      )}

      {showFeedback && !alreadyGave && (
        <FeedbackForm
          donationId={donation._id}
          onDone={() => {
            setShowFeedback(false);
            qc.invalidateQueries({ queryKey: ['donations'] });
          }}
        />
      )}
    </li>
  );
}

function FeedbackForm({ donationId, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const submit = useMutation({
    mutationFn: () => unwrap(api.post(`/donations/${donationId}/feedback`, { rating, comment })),
    onSuccess: onDone,
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= rating ? 'text-amber-400' : 'text-white/20'}
            onClick={() => setRating(n)}
            aria-label={`${n} star`}
          >
            <Star className="h-6 w-6" fill={n <= rating ? 'currentColor' : 'none'} aria-hidden />
          </button>
        ))}
      </div>
      <textarea
        className="input mt-2"
        rows={2}
        placeholder="Optional comment…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-2">
        <button className="btn-primary text-sm" disabled={submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? 'Sending…' : 'Submit'}
        </button>
        {submit.isError && <span className="text-xs text-brand-300">{submit.error.message}</span>}
      </div>
    </div>
  );
}
