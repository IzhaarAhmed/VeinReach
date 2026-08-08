import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Droplet,
  Search,
  Building2,
  MessageSquare,
  HeartHandshake,
  Bell,
  User,
  Plus,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Landmark,
  Stethoscope,
  MailWarning,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api, unwrap } from '../lib/api.js';
import { connectSocket, disconnectSocket } from '../lib/socket.js';
import { enablePush, pushAlreadyGranted } from '../lib/push.js';
import NotificationBell from './NotificationBell.jsx';
import ContrastToggle from './ContrastToggle.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const MAIN = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/requests', label: 'Requests', icon: Droplet },
  { to: '/dashboard/donors', label: 'Find Donors', icon: Search },
  { to: '/dashboard/blood-banks', label: 'Blood Banks', icon: Building2 },
];
const YOU = [
  { to: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
  { to: '/dashboard/donations', label: 'Donations', icon: HeartHandshake },
  { to: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { to: '/dashboard/profile', label: 'Profile', icon: User },
];
const PORTALS = {
  admin: { to: '/dashboard/admin', label: 'Admin Console', icon: ShieldCheck },
  bloodbank: { to: '/dashboard/bloodbank', label: 'Blood Bank', icon: Landmark },
  hospital: { to: '/dashboard/hospital', label: 'Hospital', icon: Stethoscope },
};

function NavItem({ item, onNavigate }) {
  const { to, label, icon: Icon, end } = item;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          isActive
            ? 'bg-white/[0.07] text-white'
            : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500 transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden
          />
          <Icon
            className={`h-[18px] w-[18px] ${isActive ? 'text-brand-400' : 'text-white/45 group-hover:text-white/80'}`}
            strokeWidth={2}
            aria-hidden
          />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ user, onNavigate, onLogout }) {
  const portal = PORTALS[user?.role];
  return (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5 px-3 py-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
          <Droplet className="h-5 w-5 text-white" fill="currentColor" aria-hidden />
        </span>
        <span className="text-lg font-bold tracking-tight">
          Vein<span className="text-brand-400">Reach</span>
        </span>
      </Link>

      <Link
        to="/dashboard/requests/new"
        onClick={onNavigate}
        className="btn-primary mt-5 w-full"
      >
        <Plus className="h-4 w-4" aria-hidden /> New request
      </Link>

      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto pb-4" aria-label="Main">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Main</p>
          {MAIN.map((item) => <NavItem key={item.to} item={item} onNavigate={onNavigate} />)}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">You</p>
          {YOU.map((item) => <NavItem key={item.to} item={item} onNavigate={onNavigate} />)}
        </div>
        {portal && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Portal</p>
            <NavItem item={portal} onNavigate={onNavigate} />
          </div>
        )}
      </nav>

      {/* User card */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
            {user?.avatar?.url ? (
              <img src={user.avatar.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-brand-300">{user?.bloodGroup || <User className="h-4 w-4" />}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user?.fullName}</div>
            <div className="truncate text-xs capitalize text-white/40">{user?.role}</div>
          </div>
          <button
            onClick={onLogout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    const socket = connectSocket();

    const pushToast = (text, tone) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, text, tone }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 9000);
    };

    const onInvite = (p) => {
      pushToast(p.message, 'invite');
      queryClient.invalidateQueries({ queryKey: ['meetups'] });
    };
    const onResponse = (p) => {
      pushToast(p.message, p.accepted ? 'ok' : 'bad');
      queryClient.invalidateQueries({ queryKey: ['meetups'] });
    };
    const onNewRequest = (p) => {
      const urgency = p.urgency === 'critical' ? 'CRITICAL — ' : '';
      const distance = p.distanceKm != null ? ` (~${p.distanceKm} km away)` : '';
      pushToast(`${urgency}${p.bloodGroup} blood needed at ${p.hospitalName}${distance}`, 'invite');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    };
    const onRequestUpdate = () => queryClient.invalidateQueries({ queryKey: ['requests'] });
    const onDonationConfirmed = (p) => pushToast(p.message, 'ok');
    const onChatMessage = (p) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages', p.conversationId] });
    };
    const onShortage = (p) => {
      pushToast(
        `${p.level === 'critical' ? 'CRITICAL — ' : ''}${p.bloodGroup} shortage at ${p.organizationName} (~${p.distanceKm} km)`,
        'invite'
      );
    };
    const onNotification = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

    socket.on('meetup:invite', onInvite);
    socket.on('meetup:response', onResponse);
    socket.on('request:new', onNewRequest);
    socket.on('request:update', onRequestUpdate);
    socket.on('donation:confirmed', onDonationConfirmed);
    socket.on('chat:message', onChatMessage);
    socket.on('stock:shortage', onShortage);
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('meetup:invite', onInvite);
      socket.off('meetup:response', onResponse);
      socket.off('request:new', onNewRequest);
      socket.off('request:update', onRequestUpdate);
      socket.off('donation:confirmed', onDonationConfirmed);
      socket.off('chat:message', onChatMessage);
      socket.off('stock:shortage', onShortage);
      socket.off('notification:new', onNotification);
      disconnectSocket();
    };
  }, [user, queryClient]);

  useEffect(() => {
    if (user && pushAlreadyGranted()) enablePush();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const [resendState, setResendState] = useState('');
  const resend = useMutation({
    mutationFn: () => unwrap(api.post('/auth/resend-verification')),
    onSuccess: () => setResendState('Sent! Check your inbox (and spam folder).'),
    onError: (e) => setResendState(e.message),
  });
  const emailUnverified = user && user.verification?.emailVerified === false;
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app-bg">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Sidebar — fixed rail on desktop, off-canvas drawer on mobile. */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={closeMenu} aria-hidden />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-ink-900/85 px-4 py-5 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={closeMenu}
          className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <SidebarContent user={user} onNavigate={closeMenu} onLogout={handleLogout} />
      </aside>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/70 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={() => setMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
              <Droplet className="h-5 w-5 text-brand-400" fill="currentColor" aria-hidden />
              <span className="font-bold">Vein<span className="text-brand-400">Reach</span></span>
            </Link>

            <div className="hidden flex-1 lg:block" />

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <ContrastToggle />
              <NotificationBell />
            </div>
          </div>
        </header>

        {emailUnverified && (
          <div className="border-b border-amber-500/25 bg-amber-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm text-amber-200 sm:px-6">
              <span className="flex items-center gap-2">
                <MailWarning className="h-4 w-4 shrink-0" aria-hidden />
                Verify your email to create requests and accept donations.
              </span>
              <span className="flex items-center gap-3">
                {resendState && <span className="text-xs text-amber-300/80">{resendState}</span>}
                <button
                  onClick={() => resend.mutate()}
                  disabled={resend.isPending}
                  className="rounded-lg border border-amber-400/40 px-3 py-1 text-xs font-medium hover:bg-amber-500/10"
                >
                  {resend.isPending ? 'Sending…' : 'Resend email'}
                </button>
              </span>
            </div>
          </div>
        )}

        <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </main>

        {/* A published policy has to be reachable from inside the app, not only
            from the registration form. */}
        <footer className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-5 text-xs text-white/40">
            <span>© {new Date().getFullYear()} VeinReach</span>
            <Link to="/privacy" className="transition hover:text-white/70">
              Privacy Policy
            </Link>
            <Link to="/dashboard/profile" className="transition hover:text-white/70">
              Your data
            </Link>
          </div>
        </footer>
      </div>

      {/* Real-time toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`animate-fade-in rounded-2xl border p-3.5 text-sm shadow-card backdrop-blur-xl ${
                t.tone === 'ok'
                  ? 'border-accent-500/40 bg-ink-800/95 text-accent-100'
                  : t.tone === 'bad'
                    ? 'border-white/15 bg-ink-800/95 text-white/80'
                    : 'border-brand-500/40 bg-ink-800/95 text-brand-100'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
