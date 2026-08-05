import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users as UsersIcon,
  Droplet,
  ClipboardList,
  Heart,
  CheckCircle2,
  Zap,
  ShieldCheck,
  KeyRound,
  LogOut,
  Sparkles,
  Smartphone,
  UserCog,
  Ban,
  Landmark,
  Dot,
} from 'lucide-react';
import { api, unwrap } from '../lib/api.js';

const USER_ROLES = ['donor', 'recipient', 'hospital', 'bloodbank', 'admin'];
const ORG_ROLES = ['hospital', 'bloodbank'];
const TABS = ['Overview', 'Analytics', 'Users', 'Reports', 'Audit'];

export default function AdminDashboard() {
  const [tab, setTab] = useState('Overview');
  return (
    <div className="space-y-6">
      <div className="reveal">
        <h1 className="text-3xl font-bold">Admin <span className="text-gradient">dashboard</span></h1>
        <p className="mt-1 text-white/50">Manage users, verify organizations, and moderate reports.</p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? 'bg-brand-600/25 text-brand-300' : 'text-white/60 hover:bg-white/5'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <Overview />}
      {tab === 'Analytics' && <Analytics />}
      {tab === 'Users' && <Users />}
      {tab === 'Reports' && <Reports />}
      {tab === 'Audit' && <Audit />}
    </div>
  );
}

/* ── Analytics (trends) ─────────────────────────────────────────────────── */
function Analytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-trends'],
    queryFn: () => unwrap(api.get('/admin/trends', { params: { days: 30 } })),
  });
  if (isLoading) return <p className="text-white/50">Loading trends…</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">Daily activity over the last {data.sinceDays} days.</p>
      <BarChart title="Donor & user growth" color="bg-brand-500" series={data.newUsers} />
      <BarChart title="New blood requests" color="bg-amber-500" series={data.newRequests} />
      <BarChart title="Verified donations" color="bg-emerald-500" series={data.verifiedDonations} />
    </div>
  );
}

function BarChart({ title, series = [], color }) {
  const total = series.reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...series.map((d) => d.count));
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-white/40">{total} total</span>
      </div>
      {series.length === 0 ? (
        <p className="text-sm text-white/40">No data in this window.</p>
      ) : (
        <div className="flex h-32 items-end gap-1">
          {series.map((d) => (
            <div key={d.date} className="group flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.count}`}>
              <div
                className={`w-full rounded-t ${color} opacity-70 transition group-hover:opacity-100`}
                style={{ height: `${(d.count / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Audit log ──────────────────────────────────────────────────────────── */
const AUDIT_ICON = {
  'auth.login': KeyRound,
  'auth.logout': LogOut,
  'auth.register': Sparkles,
  'auth.mobile_verified': Smartphone,
  'admin.role_change': UserCog,
  'admin.suspend': Ban,
  'admin.unsuspend': CheckCircle2,
  'admin.org_review': Landmark,
  'admin.report_resolve': ShieldCheck,
};

function Audit() {
  const { data, isFetching } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => unwrap(api.get('/admin/audit', { params: { limit: 50 } })),
  });
  const entries = data?.entries || [];

  return (
    <div className="space-y-3">
      {isFetching && <p className="text-white/50">Loading…</p>}
      {entries.length === 0 ? (
        <div className="card text-white/50">No audit entries yet.</div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => {
            const Icon = AUDIT_ICON[e.action] || Dot;
            return (
            <li key={e._id} className="card flex items-center justify-between gap-3 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/60">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <div className="font-medium text-white/90">
                    <span className="font-mono text-xs text-brand-300">{e.action}</span>
                    {e.meta?.role && <span className="ml-2 text-white/50">→ {e.meta.role}</span>}
                    {e.meta?.decision && <span className="ml-2 text-white/50">→ {e.meta.decision}</span>}
                  </div>
                  <div className="text-xs text-white/40">
                    {e.actor?.fullName || 'system'}{e.actor?.role ? ` (${e.actor.role})` : ''}
                    {e.targetId ? ` · ${e.targetType} ${String(e.targetId).slice(-6)}` : ''}
                    {e.ip ? ` · ${e.ip}` : ''}
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-white/30">{new Date(e.createdAt).toLocaleString()}</span>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────────────────────── */
function Overview() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => unwrap(api.get('/admin/stats')),
  });
  if (isLoading) return <p className="text-white/50">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total users" value={data.users?.total ?? 0} icon={UsersIcon} tint="bg-accent-500/20 text-accent-300" />
        <Stat label="Available donors" value={data.users?.availableDonors ?? 0} icon={Droplet} tint="bg-brand-600/20 text-brand-300" />
        <Stat label="Active requests" value={data.requests?.active ?? 0} icon={ClipboardList} tint="bg-sky-500/20 text-sky-300" />
        <Stat label="Verified donations" value={data.donations?.verified ?? 0} icon={Heart} tint="bg-rose-500/20 text-rose-300" />
        <Stat label="Fulfillment rate" value={data.requests?.fulfillmentRatePct != null ? `${data.requests.fulfillmentRatePct}%` : '—'} icon={CheckCircle2} tint="bg-emerald-500/20 text-emerald-300" />
        <Stat label="Avg. response" value={data.responsiveness?.avgFirstResponseMinutes != null ? `${data.responsiveness.avgFirstResponseMinutes}m` : '—'} icon={Zap} tint="bg-amber-500/20 text-amber-300" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BreakdownCard title="Users by role" rows={data.users?.byRole} />
        <BreakdownCard title="Most needed blood groups" rows={data.requests?.mostNeededBloodGroups} />
      </div>
    </div>
  );
}

function BreakdownCard({ title, rows = [] }) {
  return (
    <div className="card">
      <div className="mb-3 font-semibold">{title}</div>
      {rows.length === 0 ? (
        <p className="text-sm text-white/40">No data yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between text-sm">
              <span className="capitalize text-white/70">{r.key}</span>
              <span className="font-semibold text-white/90">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Users ──────────────────────────────────────────────────────────────── */
function Users() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [params, setParams] = useState({});
  const [msg, setMsg] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => unwrap(api.get('/admin/users', { params })),
  });

  const mut = useMutation({
    mutationFn: ({ id, kind, body }) => {
      if (kind === 'suspend') return unwrap(api.patch(`/admin/users/${id}/suspension`, body));
      if (kind === 'role') return unwrap(api.patch(`/admin/users/${id}/role`, body));
      return unwrap(api.post(`/admin/users/${id}/verify-organization`, body));
    },
    onSuccess: () => { setMsg(''); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e) => setMsg(e.message),
  });

  const search = (e) => {
    e.preventDefault();
    const p = {};
    if (filters.q) p.q = filters.q;
    if (filters.role) p.role = filters.role;
    if (filters.status) p.status = filters.status;
    setParams(p);
  };

  const users = data?.users || [];

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="card grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input className="input" placeholder="Search name or email" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        <select className="input" value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
          <option value="">All roles</option>
          {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="btn-primary">Search</button>
      </form>

      {msg && <p className="text-xs text-brand-300">{msg}</p>}
      {isFetching && <p className="text-white/50">Loading…</p>}

      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id || u._id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-white/90">
                  {u.fullName}
                  {u.isSuspended && <span className="ml-2 badge border-brand-500/40 text-brand-300">Suspended</span>}
                  {ORG_ROLES.includes(u.role) && (
                    <span className="ml-2 badge capitalize">{u.verification?.status}</span>
                  )}
                </div>
                <div className="text-xs text-white/40">{u.email} · <span className="capitalize">{u.role}</span></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="input w-auto py-1.5 text-xs"
                  value={u.role}
                  onChange={(e) => mut.mutate({ id: u.id || u._id, kind: 'role', body: { role: e.target.value } })}
                >
                  {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  onClick={() => mut.mutate({ id: u.id || u._id, kind: 'suspend', body: { suspend: !u.isSuspended } })}
                >
                  {u.isSuspended ? 'Reinstate' : 'Suspend'}
                </button>
                {ORG_ROLES.includes(u.role) && u.verification?.status !== 'verified' && (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-600/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-600/20"
                    onClick={() => mut.mutate({ id: u.id || u._id, kind: 'org', body: { decision: 'approve' } })}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verify org
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {data?.meta && <p className="text-xs text-white/40">Showing {users.length} of {data.meta.total}</p>}
    </div>
  );
}

/* ── Reports ────────────────────────────────────────────────────────────── */
function Reports() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('open');

  const { data, isFetching } = useQuery({
    queryKey: ['admin-reports', statusFilter],
    queryFn: () => unwrap(api.get('/admin/reports', { params: statusFilter ? { status: statusFilter } : {} })),
  });

  const reports = data?.reports || [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['open', 'reviewing', 'resolved', 'dismissed', ''].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${statusFilter === s ? 'bg-brand-600/25 text-brand-300' : 'text-white/60 hover:bg-white/5'}`}
          >
            {s || 'all'}
          </button>
        ))}
      </div>

      {isFetching && <p className="text-white/50">Loading…</p>}
      {reports.length === 0 ? (
        <div className="card text-white/50">No reports.</div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => <ReportRow key={r._id} report={r} onDone={() => qc.invalidateQueries({ queryKey: ['admin-reports'] })} />)}
        </ul>
      )}
    </div>
  );
}

function ReportRow({ report, onDone }) {
  const [action, setAction] = useState('none');
  const [note, setNote] = useState('');
  const resolve = useMutation({
    mutationFn: (status) => unwrap(api.post(`/admin/reports/${report._id}/resolve`, { status, action, resolutionNote: note || undefined })),
    onSuccess: onDone,
  });
  const settled = ['resolved', 'dismissed'].includes(report.status);
  const target = report.targetUser?.fullName || report.targetRequest?.hospitalName || report.targetType;

  return (
    <li className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-white/90">
            <span className="capitalize">{report.category?.replace('_', ' ')}</span>
            <span className="ml-2 text-sm text-white/50">on {target}</span>
          </div>
          <div className="text-xs text-white/40">
            by {report.reporter?.fullName || 'user'} · {new Date(report.createdAt).toLocaleDateString()}
          </div>
        </div>
        <span className={`badge capitalize ${settled ? 'border-white/15 text-white/50' : 'border-amber-500/40 text-amber-300'}`}>{report.status}</span>
      </div>
      {report.description && <p className="text-sm text-white/60">{report.description}</p>}

      {!settled && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <select className="input w-auto py-1.5 text-xs" value={action} onChange={(e) => setAction(e.target.value)}>
            {['none', 'warn', 'suspend', 'unsuspend', 'reputation_penalty'].map((a) => (
              <option key={a} value={a}>{a.replace('_', ' ')}</option>
            ))}
          </select>
          <input className="input flex-1 py-1.5 text-xs" placeholder="Resolution note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary px-3 py-1.5 text-xs" disabled={resolve.isPending} onClick={() => resolve.mutate('resolved')}>Resolve</button>
          <button className="btn-ghost px-3 py-1.5 text-xs" disabled={resolve.isPending} onClick={() => resolve.mutate('dismissed')}>Dismiss</button>
          {resolve.isError && <span className="text-xs text-brand-300">{resolve.error.message}</span>}
        </div>
      )}
      {settled && report.action && report.action !== 'none' && (
        <p className="text-xs text-white/40">Action taken: {report.action.replace('_', ' ')}</p>
      )}
    </li>
  );
}

function Stat({ label, value, icon: Icon, tint = 'bg-white/5 text-white/60' }) {
  return (
    <div className="card card-hover">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="mt-3 text-3xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-0.5 text-sm text-white/50">{label}</div>
    </div>
  );
}
