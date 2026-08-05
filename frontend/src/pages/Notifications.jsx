import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Droplet,
  ClipboardList,
  Clock,
  Heart,
  MapPin,
  MessageSquare,
  Info,
} from 'lucide-react';
import { api, unwrap } from '../lib/api.js';

const typeIcon = {
  request_new: Droplet,
  request_update: ClipboardList,
  request_expired: Clock,
  donation_confirmed: Heart,
  meetup_invite: MapPin,
  meetup_response: MessageSquare,
  chat_message: MessageSquare,
  system: Info,
};

export default function Notifications() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', 'page'],
    queryFn: () => unwrap(api.get('/notifications', { params: { limit: 50 } })),
  });

  const markAllRead = useMutation({
    mutationFn: () => unwrap(api.post('/notifications/read-all')),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markRead = useMutation({
    mutationFn: (id) => unwrap(api.patch(`/notifications/${id}/read`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (isLoading) return <p className="text-white/50">Loading notifications…</p>;
  if (error) return <p className="text-brand-300">{error.message}</p>;

  const items = data?.notifications || [];
  const unread = data?.unreadCount || 0;

  return (
    <div className="space-y-5">
      <div className="reveal flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="mt-1 text-white/50">{unread > 0 ? `${unread} unread` : 'You’re all caught up.'}</p>
        </div>
        {unread > 0 && (
          <button className="btn-ghost" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            {markAllRead.isPending ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card text-white/50">Nothing yet — alerts about nearby requests will show up here.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = typeIcon[n.type] || Info;
            return (
            <li
              key={n._id}
              className={`card flex items-start gap-3 py-4 ${n.readAt ? '' : 'border-brand-500/30'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${n.readAt ? 'bg-white/5 text-white/40' : 'bg-brand-600/20 text-brand-300'}`}>
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="flex-1">
                <div className={`font-medium ${n.readAt ? 'text-white/70' : 'text-white/95'}`}>{n.title}</div>
                {n.body && <div className="mt-0.5 text-sm text-white/50">{n.body}</div>}
                <div className="mt-1 text-[11px] text-white/30">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
              {!n.readAt && (
                <button
                  className="shrink-0 text-xs text-brand-300 hover:underline"
                  onClick={() => markRead.mutate(n._id)}
                >
                  Mark read
                </button>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
