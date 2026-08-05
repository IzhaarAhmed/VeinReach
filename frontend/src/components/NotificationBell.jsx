import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Droplet,
  ClipboardList,
  Clock,
  Heart,
  MapPin,
  MessageSquare,
  Info,
} from 'lucide-react';
import { api, unwrap } from '../lib/api.js';
import { canOfferPush, enablePush } from '../lib/push.js';

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

export default function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [offerPush, setOfferPush] = useState(canOfferPush);
  const [enablingPush, setEnablingPush] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const handleEnablePush = async () => {
    setEnablingPush(true);
    const ok = await enablePush();
    setEnablingPush(false);
    if (ok || !canOfferPush()) setOfferPush(false);
  };

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => unwrap(api.get('/notifications')),
  });

  const markAllRead = useMutation({
    mutationFn: () => unwrap(api.post('/notifications/read-all')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white ring-2 ring-ink-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-white/10 bg-ink-900/95 p-3 shadow-card backdrop-blur-xl"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-accent-300 hover:text-accent-200"
              >
                Mark all read
              </button>
            )}
          </div>

          {offerPush && (
            <button
              onClick={handleEnablePush}
              disabled={enablingPush}
              className="mb-2 flex w-full items-center gap-2 rounded-xl border border-accent-500/30 bg-accent-500/10 px-3 py-2 text-left text-xs text-accent-100 hover:bg-accent-500/20"
            >
              <Bell className="h-4 w-4 shrink-0" aria-hidden />
              {enablingPush ? 'Enabling…' : 'Enable push alerts — get blood requests even when this tab is closed'}
            </button>
          )}

          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">
              Nothing yet — alerts about nearby requests will show up here.
            </p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {items.map((n) => {
                const Icon = typeIcon[n.type] || Info;
                return (
                  <li
                    key={n._id}
                    className={`rounded-xl p-2 text-sm ${n.readAt ? 'text-white/50' : 'bg-white/5 text-white/90'}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${n.readAt ? 'bg-white/5 text-white/40' : 'bg-brand-600/20 text-brand-300'}`}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium">{n.title}</div>
                        {n.body && <div className="mt-0.5 text-xs text-white/50">{n.body}</div>}
                        <div className="mt-0.5 text-[10px] text-white/30">
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            to="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-xl py-2 text-center text-xs font-semibold text-accent-300 hover:bg-white/5"
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
