import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, Loader2, X, CalendarDays, Clock, Filter } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import type { LeaveRequest, LeaveType, LeaveBalance } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  Pending:   'bg-accent-500/15 text-amber-600 dark:text-amber-400',
  Approved:  'bg-success-500/15 text-success-600 dark:text-success-400',
  Rejected:  'bg-danger-500/15 text-danger-500',
  Cancelled: 'bg-gray-200/80 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[status] || STATUS_STYLES.Cancelled}`}>{status}</span>;
}

export default function LeavesPage() {
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'Admin' || user?.role === 'HR' || user?.role === 'Manager';
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [reviewModal, setReviewModal] = useState<LeaveRequest | null>(null);
  const [form, setForm] = useState({ leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
  const [reviewForm, setReviewForm] = useState({ status: 'Approved', comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [leavesRes, typesRes] = await Promise.all([
        api.get<LeaveRequest[]>('/leaves', { params: { status: statusFilter || undefined } }),
        api.get<LeaveType[]>('/leaves/types'),
      ]);
      setLeaves(leavesRes.data);
      setLeaveTypes(typesRes.data);
      if (form.leaveTypeId === '' && typesRes.data[0]) {
        setForm((f) => ({ ...f, leaveTypeId: typesRes.data[0]._id }));
      }
    } catch { toast.error('Failed to load leaves'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/leaves', form);
      toast.success('Leave request submitted');
      setShowModal(false);
      setForm((f) => ({ ...f, fromDate: '', toDate: '', reason: '' }));
      fetchAll();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally { setSubmitting(false); }
  }

  async function handleReview() {
    if (!reviewModal) return;
    setSubmitting(true);
    try {
      await api.put(`/leaves/${reviewModal._id}/review`, reviewForm);
      toast.success(`Leave ${reviewForm.status}`);
      setReviewModal(null);
      fetchAll();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    } finally { setSubmitting(false); }
  }

  async function handleCancel(id: string) {
    try {
      await api.delete(`/leaves/${id}`);
      toast.success('Leave cancelled');
      fetchAll();
    } catch { toast.error('Cancel failed'); }
  }

  return (
    <div className="space-y-5 max-w-5xl pb-20 lg:pb-0">

      {/* ══ HERO ══ */}
      <div className="hero-header rounded-2xl px-5 pt-5 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/50 text-xs">Leave Management</p>
            <p className="text-white font-black text-lg">Manage your time off</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm transition-colors">
            <Plus className="w-4 h-4" /> Apply Leave
          </button>
        </div>

        {/* Leave balance chips */}
        {balances.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {balances.map((b) => (
              <div key={b._id} className="flex-1 min-w-[80px] bg-white/10 rounded-xl px-3 py-2.5 text-center">
                <p className="text-white font-black text-lg leading-none">{b.remaining}</p>
                <p className="text-white/50 text-[10px] mt-0.5 truncate">{b.leaveTypeId.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ STATUS FILTER ══ */}
      <div className="flex gap-2 flex-wrap">
        {['', 'Pending', 'Approved', 'Rejected', 'Cancelled'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold transition-all ${
              statusFilter === s
                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                : 'bg-white dark:bg-[#1F2E49] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary-300'
            }`}>
            {s === '' && <Filter className="w-3.5 h-3.5" />}
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* ══ LEAVE CARDS LIST ══ */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="card p-4 skeleton h-20" />)
          : leaves.length === 0
            ? (
              <div className="card flex flex-col items-center py-14 gap-3">
                <CalendarDays className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-400 font-semibold">No leave requests found</p>
                <button onClick={() => setShowModal(true)}
                  className="mt-1 px-5 py-2.5 rounded-xl bg-primary-600 text-white font-bold text-sm">
                  Apply Leave
                </button>
              </div>
            )
            : leaves.map((leave) => (
              <div key={leave._id} className="card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  {/* Left: type + dates */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-600/10 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-gray-900 dark:text-white text-sm">{leave.leaveTypeId.name}</p>
                      {isAdminOrHR && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {leave.employeeId?.userId?.name || leave.employeeId?.employeeId || '—'}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3 h-3" />
                          {fmtDate(leave.fromDate)}
                          {leave.fromDate !== leave.toDate && <> — {fmtDate(leave.toDate)}</>}
                        </span>
                        <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                          {leave.totalDays} day{leave.totalDays !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {leave.reason && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">{leave.reason}</p>
                      )}
                    </div>
                  </div>
                  {/* Right: status + action */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <StatusBadge status={leave.status} />
                    {isAdminOrHR && leave.status === 'Pending' && (
                      <button onClick={() => { setReviewModal(leave); setReviewForm({ status: 'Approved', comment: '' }); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary-600/10 text-primary-600 font-bold hover:bg-primary-600/20 transition-colors">
                        Review
                      </button>
                    )}
                    {!isAdminOrHR && leave.status === 'Pending' && (
                      <button onClick={() => handleCancel(leave._id)} className="text-xs px-3 py-1.5 rounded-lg bg-danger-500/10 text-danger-500 font-bold hover:bg-danger-500/20 transition-colors">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
                {leave.reviewComment && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">"{leave.reviewComment}"</p>
                  </div>
                )}
              </div>
            ))
        }
      </div>

      {/* ══ APPLY LEAVE MODAL ══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 rounded-t-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-gray-900 dark:text-white text-base">Apply for Leave</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Leave Type</label>
                <select className="input" value={form.leaveTypeId} onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))} required>
                  {leaveTypes.map((lt) => <option key={lt._id} value={lt._id}>{lt.name} ({lt.daysAllowed} days/year)</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">From</label>
                  <input type="date" className="input" value={form.fromDate} onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">To</label>
                  <input type="date" className="input" value={form.toDate} min={form.fromDate} onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Reason</label>
                <textarea className="input resize-none h-20" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} required placeholder="Brief reason for the leave…" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ REVIEW MODAL ══ */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 rounded-t-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-gray-900 dark:text-white text-base">Review Leave Request</h2>
              <button onClick={() => setReviewModal(null)} className="p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="bg-gray-50 dark:bg-[#1A2840] rounded-xl p-3.5 mb-4 space-y-1.5 text-sm">
              <p><span className="text-gray-500">Employee:</span> <strong className="text-gray-900 dark:text-white">{reviewModal.employeeId?.userId?.name}</strong></p>
              <p><span className="text-gray-500">Type:</span> <strong className="text-gray-900 dark:text-white">{reviewModal.leaveTypeId.name}</strong></p>
              <p><span className="text-gray-500">Period:</span> {fmtDate(reviewModal.fromDate)} — {fmtDate(reviewModal.toDate)} · <strong>{reviewModal.totalDays} day{reviewModal.totalDays > 1 ? 's' : ''}</strong></p>
              {reviewModal.reason && <p><span className="text-gray-500">Reason:</span> {reviewModal.reason}</p>}
            </div>
            <div className="flex gap-3 mb-4">
              <button onClick={() => setReviewForm((f) => ({ ...f, status: 'Approved' }))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition-colors border-2 ${reviewForm.status === 'Approved' ? 'bg-success-500 border-success-500 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
              <button onClick={() => setReviewForm((f) => ({ ...f, status: 'Rejected' }))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition-colors border-2 ${reviewForm.status === 'Rejected' ? 'bg-danger-500 border-danger-500 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Comment <span className="font-normal text-gray-400">(optional)</span></label>
              <input className="input" value={reviewForm.comment} onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))} placeholder="Optional review note…" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setReviewModal(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={handleReview} disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
