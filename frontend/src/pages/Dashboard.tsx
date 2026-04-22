import { useEffect, useState, useCallback, useRef } from 'react';
import { Users, Clock, UserX, CalendarX, TrendingUp, RefreshCw, MapPin, Loader2,
         Home, Briefcase, Building2, CalendarDays, CheckSquare, BarChart3, Bell,
         ArrowRight, Fingerprint, LogIn, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import type { AttendanceLog, TodayPunchStatus, AttendanceMode } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TodaySummary {
  present: number; absent: number; late: number; onLeave: number;
  totalEmployees: number; recent: AttendanceLog[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function nowHHMMSS() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function elapsedSince(iso: string) {
  return Math.max(0, Date.now() - new Date(iso).getTime());
}
function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Present: 'badge-green', Late: 'badge-yellow', Absent: 'badge-red',
    Leave: 'badge-blue', HalfDay: 'badge-yellow', Holiday: 'badge-gray', WeeklyOff: 'badge-gray',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}

const MODE_OPTIONS: { value: AttendanceMode; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'Office',      label: 'Office',      icon: Building2, color: '#2E5A9E' },
  { value: 'WFH',         label: 'WFH',         icon: Home,      color: '#16A34A' },
  { value: 'Field',       label: 'Field',       icon: MapPin,    color: '#F59E0B' },
  { value: 'ClientVisit', label: 'Client Visit',icon: Briefcase, color: '#7C3AED' },
];

// ─── Check-In Widget — mirrors mobile CheckWidget exactly ─────────────────────
function CheckInWidget() {
  const [punchStatus, setPunchStatus] = useState<TodayPunchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [mode, setMode] = useState<AttendanceMode>('Office');
  const [locating, setLocating] = useState(false);
  const [clock, setClock] = useState(nowHHMMSS());
  const [elapsed, setElapsed] = useState(0);
  const [confirmOut, setConfirmOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<TodayPunchStatus>('/attendance/today-status');
      setPunchStatus(res.data);
    } catch { /* Employee with no record yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setClock(nowHHMMSS());
      if (punchStatus?.isPunchedIn && !punchStatus.isPunchedOut && punchStatus.log?.punchIn) {
        setElapsed(elapsedSince(punchStatus.log.punchIn));
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [punchStatus]);

  async function getGPS() {
    if (!navigator.geolocation) return undefined;
    return new Promise<{ lat: number; lng: number } | undefined>((resolve) => {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (p) => { setLocating(false); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
        () => { setLocating(false); resolve(undefined); },
        { timeout: 8000 },
      );
    });
  }

  async function handlePunchIn() {
    setPunching(true);
    try {
      const loc = await getGPS();
      const res = await api.post<{ message: string; lateByMinutes: number }>('/attendance/punch-in', {
        attendanceMode: mode,
        ...(loc && { lat: loc.lat, lng: loc.lng }),
      });
      const { message, lateByMinutes } = res.data;
      (await import('react-hot-toast')).default.success(message + (lateByMinutes > 0 ? ` (${lateByMinutes}m late)` : ''));
      fetchStatus();
    } catch (err: unknown) {
      (await import('react-hot-toast')).default.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Punch-in failed'
      );
    } finally { setPunching(false); }
  }

  async function handlePunchOut() {
    setPunching(true);
    setConfirmOut(false);
    try {
      const loc = await getGPS();
      const res = await api.post<{ message: string }>('/attendance/punch-out', {
        ...(loc && { lat: loc.lat, lng: loc.lng }),
      });
      (await import('react-hot-toast')).default.success(res.data.message);
      fetchStatus();
    } catch (err: unknown) {
      (await import('react-hot-toast')).default.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Punch-out failed'
      );
    } finally { setPunching(false); }
  }

  const isPunchedIn  = punchStatus?.isPunchedIn;
  const isPunchedOut = punchStatus?.isPunchedOut;
  const log          = punchStatus?.log;

  if (loading) return <div className="skeleton h-44 rounded-2xl" />;

  // ── Work day complete ──
  if (isPunchedIn && isPunchedOut && log?.punchIn && log?.punchOut) {
    const hrs = ((new Date(log.punchOut).getTime() - new Date(log.punchIn).getTime()) / 3600000).toFixed(1);
    return (
      <div className="hero-header rounded-2xl p-5 flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-full bg-success-500/20 flex items-center justify-center">
          <CheckSquare className="w-7 h-7 text-success-400" />
        </div>
        <p className="font-black text-white text-base">Work day complete ✓</p>
        <p className="text-white/60 text-sm">
          {formatTime(log.punchIn)} — {formatTime(log.punchOut)} · {hrs}h worked
        </p>
        {statusBadge(log.status)}
      </div>
    );
  }

  // ── Checked in — show elapsed timer ──
  if (isPunchedIn && log?.punchIn) {
    return (
      <div className="hero-header rounded-2xl p-5">
        <div className="flex flex-col items-center gap-3">
          {/* Timer ring */}
          <div className="w-32 h-32 rounded-full border-4 border-success-400 bg-success-500/10
                          flex flex-col items-center justify-center">
            <span className="text-success-400 font-black text-2xl leading-none tracking-wider">
              {fmtElapsed(elapsed)}
            </span>
            <span className="text-white/40 text-[10px] mt-1">elapsed</span>
          </div>
          <p className="text-white/70 text-sm">
            Checked in at <strong className="text-white">{formatTime(log.punchIn)}</strong>
          </p>
          {/* Confirm out */}
          {confirmOut ? (
            <div className="flex flex-col items-center gap-2 w-full">
              <p className="text-yellow-300 font-bold text-sm">Confirm check out?</p>
              <div className="flex gap-2 w-full">
                <button onClick={() => setConfirmOut(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/15 text-white font-bold text-sm">
                  Cancel
                </button>
                <button onClick={handlePunchOut} disabled={punching}
                  className="flex-1 py-2.5 rounded-xl bg-danger-500 text-white font-bold text-sm flex items-center justify-center gap-1 disabled:opacity-60">
                  {punching ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Yes, Check Out
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmOut(true)} disabled={punching}
              className="w-full py-3.5 rounded-xl bg-danger-500 hover:bg-danger-600 text-white font-black
                         flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60
                         shadow-lg shadow-danger-500/30">
              <LogOut className="w-5 h-5" /> Check Out
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Not checked in ──
  return (
    <div className="hero-header rounded-2xl p-5">
      <div className="flex flex-col items-center gap-4">
        {/* Live clock */}
        <div className="text-center">
          <p className="text-white/50 text-xs mb-1">Current Time</p>
          <p className="text-white font-black text-4xl tracking-widest">{clock}</p>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-2 w-full">
          {MODE_OPTIONS.map(({ value, label, icon: Icon, color }) => (
            <button key={value} onClick={() => setMode(value)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                mode === value
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'border-white/10 text-white/50 hover:bg-white/10'
              }`}>
              <Icon className="w-4 h-4" style={{ color: mode === value ? '#fff' : color }} />
              {label}
            </button>
          ))}
        </div>

        {/* Check in button */}
        <button onClick={handlePunchIn} disabled={punching || locating}
          className="w-full py-4 rounded-xl bg-success-500 hover:bg-success-600 text-white font-black
                     text-base flex items-center justify-center gap-2 transition-all active:scale-95
                     disabled:opacity-60 shadow-lg shadow-success-500/30">
          {(punching || locating)
            ? <><Loader2 className="w-5 h-5 animate-spin" />{locating ? 'Getting GPS…' : 'Processing…'}</>
            : <><LogIn className="w-5 h-5" />Check In Now</>
          }
        </button>
        <p className="text-white/30 text-[11px]">GPS location captured automatically</p>
      </div>
    </div>
  );
}

// ─── Action Tile — matches mobile ActionTile ──────────────────────────────────
function ActionTile({ icon: Icon, label, color, badge, onClick }: {
  icon: React.ElementType; label: string; color: string; badge?: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="action-tile text-left group">
      <div className="action-tile-icon" style={{ backgroundColor: color + '18' }}>
        <Icon className="w-5 h-5" style={{ color }} />
        {!!badge && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger-500 text-white text-[9px] font-black flex items-center justify-center">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="action-tile-label">{label}</span>
    </button>
  );
}

// ─── Stat chip (matches mobile month summary row) ─────────────────────────────
function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center rounded-xl py-3 px-1 border"
         style={{ backgroundColor: color + '12', borderColor: color + '28' }}>
      <span className="text-xl font-black" style={{ color }}>{value}</span>
      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<Array<{ name: string; present: number; late: number; absent: number }>>([]);

  const isAdminOrHR = user?.role === 'Admin' || user?.role === 'HR' || user?.role === 'Manager';

  const fetchData = useCallback(async () => {
    if (!isAdminOrHR) { setLoading(false); return; }
    try {
      const [todayRes, reportRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/reports/monthly'),
      ]);
      setSummary(todayRes.data);
      const daily = (reportRes.data.dailyBreakdown as Array<{ date: string; present: number; late: number; absent: number }>).slice(-7);
      setChartData(daily.map((d) => ({
        name: new Date(d.date).toLocaleDateString([], { weekday: 'short' }),
        present: d.present, late: d.late, absent: d.absent,
      })));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [isAdminOrHR]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useWebSocket('attendance:update', useCallback(() => { fetchData(); }, [fetchData]));

  const greet = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();
  const dateFmt = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const attendanceRate = summary && summary.totalEmployees > 0
    ? Math.round(((summary.present + summary.late) / summary.totalEmployees) * 100) : 0;

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ══ HERO HEADER — same as mobile DashboardScreen hero ══ */}
      <div className="hero-header rounded-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-0">
          {/* Greeting row */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/60 text-sm">{greet} 👋</p>
              <p className="text-white font-black text-xl mt-0.5">{user?.name}</p>
              <p className="text-white/40 text-xs mt-0.5">{dateFmt}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/15 text-white">
                {user?.role}
              </span>
              <button className="relative p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                <Bell className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
              </button>
              {isAdminOrHR && (
                <button onClick={fetchData} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                  <RefreshCw className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>

          {/* Admin stat chips — matches mobile "This Month" row */}
          {isAdminOrHR && (
            <div className="flex gap-2 pb-5">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex-1 skeleton h-14 rounded-xl" />)
                : [
                    { label: 'Present', value: summary?.present ?? 0, color: '#16A34A' },
                    { label: 'Late',    value: summary?.late    ?? 0, color: '#F59E0B' },
                    { label: 'Absent',  value: summary?.absent  ?? 0, color: '#DC2626' },
                    { label: 'On Leave',value: summary?.onLeave ?? 0, color: '#2563EB' },
                  ].map((s) => <StatChip key={s.label} {...s} />)
              }
            </div>
          )}
        </div>
      </div>

      {/* ══ CHECK-IN WIDGET (always shown for all roles — below hero on larger screens) ══ */}
      <CheckInWidget />

      {/* ══ QUICK ACTIONS — matches mobile ActionTile grid ══ */}
      <div>
        <p className="section-title">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ActionTile icon={Clock}       label="My Attendance" color="#2E5A9E" onClick={() => navigate('/attendance')} />
          <ActionTile icon={CalendarDays} label="Apply Leave"   color="#16A34A" onClick={() => navigate('/leaves')} />
          <ActionTile icon={Home}        label="WFH Request"   color="#7C3AED" onClick={() => navigate('/approvals')} />
          {isAdminOrHR && <ActionTile icon={CheckSquare} label="Approvals"   color="#F59E0B" onClick={() => navigate('/approvals')} />}
          {isAdminOrHR && <ActionTile icon={Users}       label="Employees"   color="#0891B2" onClick={() => navigate('/employees')} />}
          {isAdminOrHR && <ActionTile icon={BarChart3}   label="Reports"     color="#DC2626" onClick={() => navigate('/reports')} />}
          {(user?.role === 'Admin') && <ActionTile icon={Fingerprint} label="Devices" color="#6D28D9" onClick={() => navigate('/devices')} />}
        </div>
      </div>

      {/* ══ ATTENDANCE RATE CARD (Admin/HR) ══ */}
      {isAdminOrHR && summary && !loading && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              <span className="font-black text-gray-900 dark:text-white text-sm">Today's Attendance Rate</span>
            </div>
            <span className="text-xl font-black text-success-500">{attendanceRate}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-success-500 rounded-full transition-all duration-700"
                 style={{ width: `${attendanceRate}%` }} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {(summary?.present ?? 0) + (summary?.late ?? 0)} of {summary?.totalEmployees ?? 0} employees present
          </p>
        </div>
      )}

      {/* ══ CHART + RECENT ACTIVITY (Admin/HR) ══ */}
      {isAdminOrHR && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Weekly chart */}
          <div className="lg:col-span-2 card p-5">
            <p className="section-title">Last 7 Days</p>
            {loading
              ? <div className="skeleton h-48 rounded-xl" />
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barSize={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }} />
                    <Bar dataKey="present" fill="#16A34A" name="Present" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late"    fill="#F59E0B" name="Late"    radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent"  fill="#DC2626" name="Absent"  radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* Recent activity */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="section-title mb-0">Recent Activity</p>
              <button onClick={() => navigate('/attendance')}
                className="text-primary-600 dark:text-primary-400 text-xs font-bold flex items-center gap-1 hover:underline">
                See all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {loading
              ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-3/4 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                    </div>
                  </div>
                ))}</div>
              : (
                <div className="space-y-3 max-h-52 overflow-y-auto">
                  {(summary?.recent || []).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No activity today</p>
                  )}
                  {(summary?.recent || []).map((log) => {
                    const emp = log.employeeId as { employeeId?: string; userId?: { name?: string } };
                    const name = emp?.userId?.name || (log.employee as { user?: { name?: string } })?.user?.name || emp?.employeeId || 'Unknown';
                    return (
                      <div key={log._id || log.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-600/10 flex items-center justify-center
                                        text-primary-600 text-xs font-black shrink-0">
                          {String(name)[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            In: {formatTime(log.punchIn)} {log.punchOut ? `· Out: ${formatTime(log.punchOut)}` : ''}
                          </p>
                        </div>
                        {statusBadge(log.status)}
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  );
}

