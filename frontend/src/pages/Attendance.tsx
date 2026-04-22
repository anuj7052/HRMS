import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Clock, Loader2, X,
  Users, User, RefreshCw, Search, MapPin, CalendarDays,
  CheckCircle, AlertCircle, XCircle, MinusCircle, CalendarCheck
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import type { AttendanceLog, Employee, AttendanceStatus } from '../types';

const STATUS_DOT: Record<AttendanceStatus, string> = {
  Present: 'bg-success-500',  Late: 'bg-accent-500',
  Absent: 'bg-danger-500',    HalfDay: 'bg-yellow-400',
  Leave: 'bg-blue-500',       Holiday: 'bg-gray-400',  WeeklyOff: 'bg-purple-400',
};
const STATUS_TILE: Record<AttendanceStatus, string> = {
  Present: 'bg-success-500/15 text-success-600',
  Late: 'bg-accent-500/15 text-amber-600',
  Absent: 'bg-danger-500/15 text-danger-500',
  HalfDay: 'bg-yellow-500/15 text-yellow-600',
  Leave: 'bg-blue-500/15 text-blue-600',
  Holiday: 'bg-gray-200/80 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  WeeklyOff: 'bg-purple-500/15 text-purple-600',
};
const MODE_COLORS: Record<string, string> = {
  Office: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  WFH: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Field: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ClientVisit: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

function formatTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function getFirstDayOfWeek(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }

interface MonthlySummaryRow {
  _id: string; id?: string;
  employeeId: string; name: string; department?: string;
  Present: number; Late: number; Absent: number;
  Leave: number; WeeklyOff: number; Holiday: number; HalfDay: number;
  total: number;
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const icons: Partial<Record<AttendanceStatus, React.ElementType>> = {
    Present: CheckCircle, Late: AlertCircle, Absent: XCircle, HalfDay: MinusCircle,
  };
  const Icon = icons[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_TILE[status]}`}>
      {Icon && <Icon className="w-3 h-3" />}{status}
    </span>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 flex flex-col items-center py-3 px-1 rounded-xl border"
         style={{ backgroundColor: color + '12', borderColor: color + '28' }}>
      <span className="text-xl font-black" style={{ color }}>{value}</span>
      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5 text-center leading-tight">{label}</span>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [regularizeModal, setRegularizeModal] = useState<AttendanceLog | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'individual' | 'summary'>('summary');
  const [summaryData, setSummaryData] = useState<MonthlySummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarySearch, setSummarySearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMsg, setLastSyncMsg] = useState('');

  const isAdminOrHR = user?.role === 'Admin' || user?.role === 'HR' || user?.role === 'Manager';

  useEffect(() => {
    if (isAdminOrHR) {
      api.get<{ data: Employee[] }>('/employees', { params: { limit: 200 } }).then((res) => {
        setEmployees(res.data.data);
        if (res.data.data.length > 0 && !selectedEmployee)
          setSelectedEmployee(res.data.data[0]._id || res.data.data[0].id || '');
      });
    } else {
      api.get<{ data: Employee[] }>('/employees', { params: { limit: 1 } }).then((res) => {
        if (res.data.data[0]) setSelectedEmployee(res.data.data[0]._id || res.data.data[0].id || '');
      });
    }
  }, [isAdminOrHR]);

  const fetchSummary = useCallback(async () => {
    if (!isAdminOrHR) return;
    setSummaryLoading(true);
    try {
      const res = await api.get<{ summary: MonthlySummaryRow[] }>('/attendance/monthly-summary', { params: { month, year } });
      setSummaryData(res.data.summary);
    } catch { toast.error('Failed to load summary'); }
    finally { setSummaryLoading(false); }
  }, [isAdminOrHR, month, year]);

  useEffect(() => { if (viewMode === 'summary') fetchSummary(); }, [fetchSummary, viewMode]);

  const fetchLogs = useCallback(async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    try {
      const res = await api.get<{ logs: AttendanceLog[] }>(`/attendance/employee/${selectedEmployee}`, { params: { month, year } });
      setLogs(res.data.logs);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }, [selectedEmployee, month, year]);

  useEffect(() => { if (viewMode === 'individual' || !isAdminOrHR) fetchLogs(); }, [fetchLogs, viewMode, isAdminOrHR]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1);
  }

  async function handleLiveSync() {
    setSyncing(true); setLastSyncMsg('');
    try {
      const res = await api.post<{ message: string; totalLogsImported: number }>('/attendance/sync-live');
      setLastSyncMsg(res.data.message); toast.success(res.data.message);
      if (viewMode === 'summary') fetchSummary(); else fetchLogs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Sync failed';
      setLastSyncMsg(msg); toast.error(msg);
    } finally { setSyncing(false); }
  }

  async function submitRegularization() {
    if (!regularizeModal || reason.trim().length < 10) { toast.error('Provide reason (min 10 chars)'); return; }
    setSubmitting(true);
    try {
      const id = regularizeModal._id || regularizeModal.id;
      await api.post('/attendance/regularize', { attendanceId: id, reason });
      toast.success('Regularization request submitted');
      setRegularizeModal(null); setReason(''); fetchLogs();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally { setSubmitting(false); }
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfWeek(year, month);
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  const logMap = new Map<number, AttendanceLog>();
  logs.forEach((log) => { logMap.set(new Date(log.date).getDate(), log); });
  const stats = {
    present: logs.filter((l) => l.status === 'Present').length,
    late: logs.filter((l) => l.status === 'Late').length,
    absent: logs.filter((l) => l.status === 'Absent').length,
    leave: logs.filter((l) => l.status === 'Leave').length,
    weeklyOff: logs.filter((l) => l.status === 'WeeklyOff').length,
  };

  return (
    <div className="space-y-5 max-w-5xl pb-20 lg:pb-0">

      {/* HERO */}
      <div className="hero-header rounded-2xl px-5 pt-5 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/50 text-xs">Attendance</p>
            <p className="text-white font-black text-lg">Track your work days</p>
          </div>
          {isAdminOrHR && (
            <button onClick={handleLiveSync} disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold disabled:opacity-60 transition-colors">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Live Sync'}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-2.5">
          <button onClick={prevMonth} className="p-1 rounded-lg hover:bg-white/20 text-white"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-white font-black text-base">{monthName} {year}</span>
          <button onClick={nextMonth} className="p-1 rounded-lg hover:bg-white/20 text-white"><ChevronRight className="w-5 h-5" /></button>
        </div>
        {lastSyncMsg && (
          <div className={`mt-3 flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${lastSyncMsg.toLowerCase().includes('fail') || lastSyncMsg.toLowerCase().includes('could not') ? 'bg-danger-500/20 text-red-200' : 'bg-success-500/20 text-green-200'}`}>
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">{lastSyncMsg}</span>
            <button onClick={() => setLastSyncMsg('')}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>

      {/* VIEW TOGGLE */}
      {isAdminOrHR && (
        <div className="flex bg-gray-100 dark:bg-[#1A2840] rounded-xl p-1 gap-1">
          {(['summary', 'individual'] as const).map((val) => (
            <button key={val} onClick={() => setViewMode(val)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === val ? 'bg-white dark:bg-[#1F2E49] text-primary-600 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {val === 'summary' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
              {val === 'summary' ? 'All Employees' : 'Individual'}
            </button>
          ))}
        </div>
      )}

      {/* EMPLOYEE SELECTOR */}
      {isAdminOrHR && viewMode === 'individual' && (
        <select className="input" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
          {employees.map((emp) => (
            <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.userId.name} ({emp.employeeId})</option>
          ))}
        </select>
      )}

      {/* SUMMARY TABLE */}
      {isAdminOrHR && viewMode === 'summary' && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 border border-gray-200 dark:border-gray-700">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input type="text" placeholder="Search employee…" className="bg-transparent flex-1 text-sm outline-none placeholder-gray-400"
                value={summarySearch} onChange={(e) => setSummarySearch(e.target.value)} />
              {summarySearch && <button onClick={() => setSummarySearch('')}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
            </div>
            <span className="text-xs text-gray-400">{summaryData.filter((r) => r.total > 0).length} employees</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#1A2840]/60 text-left">
                  {['Employee','Dept','P','L','A','½D','Lv','W/O','Hol','Total'].map((h) => (
                    <th key={h} className="px-3 py-3 font-bold text-gray-500 dark:text-gray-400 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summaryLoading
                  ? Array.from({ length: 6 }).map((_, i) => <tr key={i}>{Array.from({ length: 10 }).map((_, j) => <td key={j} className="px-3 py-3"><div className="skeleton h-3.5 rounded" /></td>)}</tr>)
                  : summaryData.filter((r) => r.total > 0)
                      .filter((r) => !summarySearch || [r.name, r.employeeId, r.department || ''].some((s) => s.toLowerCase().includes(summarySearch.toLowerCase())))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((row) => (
                        <tr key={row._id || row.id} className="hover:bg-primary-600/5 cursor-pointer transition-colors"
                          onClick={() => { setSelectedEmployee(row._id || row.id || ''); setViewMode('individual'); }}>
                          <td className="px-3 py-3">
                            <p className="font-bold text-gray-900 dark:text-white text-[13px]">{row.name}</p>
                            <p className="text-[11px] text-gray-400">{row.employeeId}</p>
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">{row.department || '—'}</td>
                          <td className="px-3 py-3 font-black text-success-600 text-center">{row.Present || '—'}</td>
                          <td className="px-3 py-3 font-black text-amber-500 text-center">{row.Late || '—'}</td>
                          <td className="px-3 py-3 font-black text-danger-500 text-center">{row.Absent || '—'}</td>
                          <td className="px-3 py-3 text-yellow-500 text-center">{row.HalfDay || '—'}</td>
                          <td className="px-3 py-3 text-blue-500 text-center">{row.Leave || '—'}</td>
                          <td className="px-3 py-3 text-purple-500 text-center">{row.WeeklyOff || '—'}</td>
                          <td className="px-3 py-3 text-gray-400 text-center">{row.Holiday || '—'}</td>
                          <td className="px-3 py-3 font-black text-gray-700 dark:text-gray-200 text-center">{row.total}</td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INDIVIDUAL VIEW */}
      {(!isAdminOrHR || viewMode === 'individual') && (
        <>
          <div className="flex gap-2">
            <StatChip label="Present"  value={stats.present}   color="#16A34A" />
            <StatChip label="Late"     value={stats.late}      color="#F59E0B" />
            <StatChip label="Absent"   value={stats.absent}    color="#DC2626" />
            <StatChip label="Leave"    value={stats.leave}     color="#2563EB" />
            <StatChip label="W/Off"    value={stats.weeklyOff} color="#9333EA" />
          </div>

          <div className="card p-4">
            <div className="grid grid-cols-7 mb-2">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} className="text-center text-[11px] font-bold text-gray-400 dark:text-gray-500 py-1">{d}</div>
              ))}
            </div>
            {loading
              ? <div className="grid grid-cols-7 gap-1">{Array.from({ length: 35 }).map((_, i) => <div key={i} className="skeleton h-11 rounded-xl" />)}</div>
              : (
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const log = logMap.get(day);
                    const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
                    const isFuture = new Date(year, month - 1, day) > today;
                    return (
                      <button key={day} onClick={() => log && !isFuture && setRegularizeModal(log)}
                        className={`relative flex flex-col items-center justify-center h-11 rounded-xl text-xs font-bold transition-all ${
                          isFuture ? 'text-gray-300 dark:text-gray-700 cursor-default' :
                          log ? `${STATUS_TILE[log.status]} hover:opacity-80 cursor-pointer` :
                          'text-gray-400 dark:text-gray-600 cursor-default'
                        } ${isToday ? 'ring-2 ring-primary-600 dark:ring-primary-400 ring-offset-1' : ''}`}
                        title={log ? `${log.status} | ${formatTime(log.punchIn)} → ${formatTime(log.punchOut)}` : ''}>
                        {log && !isFuture && <span className={`absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full ${STATUS_DOT[log.status]}`} />}
                        {day}
                      </button>
                    );
                  })}
                </div>
              )
            }
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              {Object.entries(STATUS_DOT).map(([status, dot]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary-600" />
              <h2 className="font-black text-gray-900 dark:text-white text-sm">Daily Records</h2>
            </div>
            {loading
              ? <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-10 h-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3.5 w-1/3 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                    </div>
                  </div>
                ))}</div>
              : logs.length === 0
                ? <div className="flex flex-col items-center py-12 gap-3">
                    <CalendarCheck className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                    <p className="text-gray-400 text-sm">No records for {monthName} {year}</p>
                  </div>
                : <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {logs.map((log) => {
                      const id = log._id || log.id;
                      const canRegularize = (log.status === 'Absent' || log.status === 'Late') && !log.isRegularized && log.regularizationStatus !== 'Pending';
                      return (
                        <div key={id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-[#1A2840]/40 transition-colors">
                          <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${STATUS_TILE[log.status]}`}>
                            <span className="text-sm font-black leading-none">{new Date(log.date).getDate()}</span>
                            <span className="text-[9px] font-semibold uppercase leading-none mt-0.5">{new Date(log.date).toLocaleString('default', { weekday: 'short' })}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <StatusBadge status={log.status} />
                              {log.attendanceMode && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${MODE_COLORS[log.attendanceMode] || MODE_COLORS.Office}`}>{log.attendanceMode}</span>
                              )}
                              {log.regularizationStatus === 'Pending' && <span className="badge-yellow text-[10px]">Pending</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              {log.punchIn && (
                                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Clock className="w-3 h-3 text-success-500" />{formatTime(log.punchIn)}
                                  {(log.punchInLocation || log.punchInLat) && <MapPin className="w-2.5 h-2.5 text-success-400" />}
                                </span>
                              )}
                              {log.punchOut && (
                                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Clock className="w-3 h-3 text-danger-500" />{formatTime(log.punchOut)}
                                  {(log.punchOutLocation || log.punchOutLat) && <MapPin className="w-2.5 h-2.5 text-success-400" />}
                                </span>
                              )}
                              {log.workHours && <span className="text-xs text-gray-400">· {log.workHours}h</span>}
                            </div>
                          </div>
                          {canRegularize && (
                            <button onClick={() => setRegularizeModal(log)} className="shrink-0 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline">Regularize</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
            }
          </div>
        </>
      )}

      {/* REGULARIZATION MODAL */}
      {regularizeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 rounded-t-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-gray-900 dark:text-white text-base">Request Regularization</h2>
                <p className="text-sm text-gray-500 mt-0.5">{new Date(regularizeModal.date).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <button onClick={() => setRegularizeModal(null)} className="p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <StatusBadge status={regularizeModal.status} />
              <span className="text-sm text-gray-600 dark:text-gray-300">In: {formatTime(regularizeModal.punchIn)} · Out: {formatTime(regularizeModal.punchOut)}</span>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Reason <span className="text-xs font-normal text-gray-400">(min 10 chars)</span></label>
              <textarea className="input resize-none h-24" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why attendance needs to be regularized…" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRegularizeModal(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={submitRegularization} disabled={submitting} className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
