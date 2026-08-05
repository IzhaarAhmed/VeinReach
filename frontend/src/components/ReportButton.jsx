import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';

const CATEGORIES = ['spam', 'fake_request', 'no_show', 'abuse', 'fraud', 'impersonation', 'other'];

/**
 * Compact abuse-report control. Pass either targetRequestId or targetUserId.
 * Expands into a tiny inline form; posts to /reports.
 */
export default function ReportButton({ targetType, targetRequestId, targetUserId }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('fake_request');
  const [description, setDescription] = useState('');
  const [done, setDone] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      unwrap(
        api.post('/reports', {
          targetType,
          targetRequestId,
          targetUserId,
          category,
          description: description || undefined,
        })
      ),
    onSuccess: () => { setDone('Report submitted for review.'); setOpen(false); },
    onError: (e) => setDone(e.message),
  });

  if (done) return <p className="text-xs text-white/40">{done}</p>;

  if (!open)
    return (
      <button type="button" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-brand-300" onClick={() => setOpen(true)}>
        <Flag className="h-3.5 w-3.5" aria-hidden /> Report
      </button>
    );

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto py-1.5 text-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
        <input
          className="input flex-1 py-1.5 text-xs"
          placeholder="What's wrong? (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={submit.isPending} onClick={() => submit.mutate()}>
          Send
        </button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
