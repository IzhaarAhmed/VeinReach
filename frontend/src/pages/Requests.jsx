import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '../lib/api.js';
import ReportButton from '../components/ReportButton.jsx';

const urgencyColor = {
  critical: 'bg-brand-600 text-white',
  urgent: 'bg-amber-500/90 text-white',
  normal: 'bg-white/10 text-white/70',
};

export default function Requests() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['requests', 'active'],
    queryFn: () => unwrap(api.get('/requests')),
  });

  const accept = useMutation({
    mutationFn: (id) => unwrap(api.post(`/requests/${id}/accept`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  });

  if (isLoading) return <p className="text-white/50">Loading requests…</p>;
  if (error) return <p className="text-brand-300">{error.message}</p>;

  const requests = data?.requests || [];

  return (
    <div className="space-y-5">
      <div className="reveal">
        <h1 className="text-3xl font-bold">Active blood requests</h1>
        <p className="mt-1 text-white/50">Accept a request you're compatible with and eligible for.</p>
      </div>

      {requests.length === 0 ? (
        <div className="card text-white/50">No active requests right now.</div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {requests.map((r) => (
            <li key={r._id} className="card card-hover space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600/20 text-base font-bold text-brand-300">
                  {r.bloodGroup}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${urgencyColor[r.urgency]}`}>
                  {r.urgency}
                </span>
              </div>
              <div>
                <p className="font-medium text-white/90">{r.hospitalName}</p>
                {r.hospitalAddress && <p className="text-xs text-white/40">{r.hospitalAddress}</p>}
              </div>
              <p className="text-sm text-white/70">
                Units needed: <strong className="text-white">{r.unitsRequired}</strong>
              </p>
              {r.notes && <p className="text-sm text-white/50">{r.notes}</p>}

              <button
                onClick={() => accept.mutate(r._id)}
                disabled={accept.isPending}
                className="btn-primary w-full"
              >
                {accept.isPending ? 'Accepting…' : 'Accept request'}
              </button>
              {accept.isError && (
                <p className="text-xs text-brand-300">{accept.error.message}</p>
              )}
              <div className="flex justify-end pt-1">
                <ReportButton targetType="request" targetRequestId={r._id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
