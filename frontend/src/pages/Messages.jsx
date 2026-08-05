import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Droplet } from 'lucide-react';
import { api, unwrap } from '../lib/api.js';

const timeAgo = (d) => {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString();
};

export default function Messages() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => unwrap(api.get('/chat/conversations')),
  });

  if (isLoading) return <p className="text-white/50">Loading conversations…</p>;
  if (error) return <p className="text-brand-300">{error.message}</p>;

  const conversations = data?.conversations || [];

  return (
    <div className="space-y-5">
      <div className="reveal">
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="mt-1 text-white/50">Coordinate securely — phone numbers stay hidden until you both agree.</p>
      </div>

      {conversations.length === 0 ? (
        <div className="card text-white/50">
          No conversations yet. Start one from a donor's card in <Link to="/dashboard/donors" className="text-brand-400 hover:underline">Find Donors</Link>.
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link to={`/dashboard/messages/${c.id}`} className="card card-hover flex items-center gap-4 py-4">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
                  {c.peer?.avatarUrl ? (
                    <img src={c.peer.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-brand-300">{c.peer?.bloodGroup || <Droplet className="h-4 w-4" fill="currentColor" aria-hidden />}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-white/90">
                      {c.peer?.fullName || 'Unknown'}
                      {c.peer?.role && c.peer.role !== 'donor' && (
                        <span className="ml-2 text-xs capitalize text-white/40">{c.peer.role}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-white/30">{timeAgo(c.lastMessage?.at || c.updatedAt)}</span>
                  </div>
                  <div className="truncate text-sm text-white/50">
                    {c.lastMessage?.text || 'No messages yet'}
                  </div>
                </div>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white">
                    {c.unread > 9 ? '9+' : c.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
