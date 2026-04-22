import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Loader2, X } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import type { LeaveRequest, WFHRequest, AttendanceLog } from '../types';

type Tab = 'leaves' | 'wfh' | 'regularizations';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: 'badge-yellow',
    Approved: 'badge-green',
    Rejected: 'badge-red',
    Cancelled: 'badge-gray',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}

function ReviewModal({
  title,
  details,
  comment,
  onCommentChange,
  onClose,
  onApprove,
  onReject,
  submitting,
}: {
  title: string;
  details: { label: string; value: string }[];
  comment: string;
  onCommentChange: (v: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
      <div className="card w-full max-w-md p-6 animate-slide-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 space-y-1.5 text-sm">
          {details.map(({ label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0 w-16">{label}:</span>
              <span className="text-gray-700 dark:text-gray-300 break-words">{value}</span>
            </div>
          ))}
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Comment (optional)
          </label>
          <input
            type="text"
            className="input"
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Add a comment..."
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReject}
            disabled={submitting}
            className="btn-danger flex-1 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Reject
          </button>
          <button
            onClick={onApprove}
            disabled={submitting}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>('leaves');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [wfhRequests, setWfhRequests] = useState<WFHRequest[]>([]);
  const [regularizations, setRegularizations] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewLeave, setReviewLeave] = useState<LeaveRequest | null>(null);
  const [reviewWFH, setReviewWFH] = useState<WFHRequest | null>(null);
  const [reviewReg, setReviewReg] = useState<AttendanceLog | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [leavesRes, wfhRes, regRes] = await Promise.all([
        api.get<LeaveRequest[]>('/leaves', { params: { status: 'Pending' } }),
        api.get<WFHRequest[]>('/attendance/wfh-requests', { params: { status: 'Pending' } }),
        api.get<AttendanceLog[]>('/attendance/regularizations'),
      ]);
      setLeaves(leavesRes.data);
      setWfhRequests(wfhRes.data);
      setRegularizations(regRes.data);
    } catch {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleLeaveReview(status: 'Approved' | 'Rejected') {
    if (!reviewLeave) return;
    setSubmitting(true);
    try {
      await api.put(`/leaves/${reviewLeave._id}/review`, { status, comment });
      toast.success(`Leave ${status}`);
      setReviewLeave(null);
      setComment('');
      fetchAll();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWFHReview(status: 'Approved' | 'Rejected') {
    if (!reviewWFH) return;
    setSubmitting(true);
    try {
      await api.put(`/attendance/wfh-requests/${reviewWFH._id}/review`, {
        status,
        reviewComment: comment,
      });
      toast.success(`WFH request ${status}`);
      setReviewWFH(null);
      setComment('');
      fetchAll();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegReview(status: 'Approved' | 'Rejected') {
    if (!reviewReg) return;
    setSubmitting(true);
    try {
      await api.put(`/attendance/regularizations/${reviewReg._id}/review`, { status, comment });
      toast.success(`Regularization ${status}`);
      setReviewReg(null);
      setComment('');
      fetchAll();
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'leaves', label: 'Leaves', count: leaves.length },
    { id: 'wfh', label: 'WFH', count: wfhRequests.length },
    { id: 'regularizations', label: 'Regularizations', count: regularizations.length },
  ];

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pending Approvals</h1>

      {/* Tab bar */}
      <div className="card p-1 flex gap-1">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === id
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  tab === id
                    ? 'bg-white/20 text-white'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leaves tab */}
      {tab === 'leaves' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-left border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Employee</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Type</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Dates</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                    Reason
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="skeleton h-4 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                      No pending leave requests
                    </td>
                  </tr>
                ) : (
                  leaves.map((leave) => (
                    <tr key={leave._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {leave.employeeId?.userId?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {leave.leaveTypeId.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {new Date(leave.fromDate).toLocaleDateString()} –{' '}
                        {new Date(leave.toDate).toLocaleDateString()}
                        <span className="text-xs text-gray-400 ml-1">({leave.totalDays}d)</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell max-w-xs truncate">
                        {leave.reason}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={leave.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setReviewLeave(leave);
                            setComment('');
                          }}
                          className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 px-2 py-1 rounded hover:bg-primary-100 transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WFH tab */}
      {tab === 'wfh' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-left border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Employee</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Mode</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                    Reason
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="skeleton h-4 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : wfhRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                      No pending WFH requests
                    </td>
                  </tr>
                ) : (
                  wfhRequests.map((req) => {
                    const emp = req.employeeId as {
                      _id: string;
                      employeeId: string;
                      userId?: { name: string };
                    };
                    return (
                      <tr key={req._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {emp?.userId?.name || emp?.employeeId || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {new Date(req.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{req.mode}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell max-w-xs truncate">
                          {req.reason}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setReviewWFH(req);
                              setComment('');
                            }}
                            className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 px-2 py-1 rounded hover:bg-primary-100 transition-colors"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regularizations tab */}
      {tab === 'regularizations' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 text-left border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Employee</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    Att. Status
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                    Reason
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="skeleton h-4 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : regularizations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                      No pending regularization requests
                    </td>
                  </tr>
                ) : (
                  regularizations.map((log) => {
                    const emp = log.employeeId as {
                      _id: string;
                      employeeId: string;
                      userId?: { name: string };
                    };
                    return (
                      <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {emp?.userId?.name || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {new Date(log.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell max-w-xs truncate">
                          {log.regularizationReason || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setReviewReg(log);
                              setComment('');
                            }}
                            className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 px-2 py-1 rounded hover:bg-primary-100 transition-colors"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Leave Modal */}
      {reviewLeave && (
        <ReviewModal
          title="Review Leave Request"
          details={[
            { label: 'Employee', value: reviewLeave.employeeId?.userId?.name || '—' },
            { label: 'Type', value: reviewLeave.leaveTypeId.name },
            { label: 'From', value: new Date(reviewLeave.fromDate).toLocaleDateString() },
            { label: 'To', value: new Date(reviewLeave.toDate).toLocaleDateString() },
            { label: 'Days', value: String(reviewLeave.totalDays) },
            { label: 'Reason', value: reviewLeave.reason || '—' },
          ]}
          comment={comment}
          onCommentChange={setComment}
          onClose={() => setReviewLeave(null)}
          onApprove={() => handleLeaveReview('Approved')}
          onReject={() => handleLeaveReview('Rejected')}
          submitting={submitting}
        />
      )}

      {/* Review WFH Modal */}
      {reviewWFH && (
        <ReviewModal
          title="Review WFH Request"
          details={[
            { label: 'Date', value: new Date(reviewWFH.date).toLocaleDateString() },
            { label: 'Mode', value: reviewWFH.mode },
            { label: 'Reason', value: reviewWFH.reason },
          ]}
          comment={comment}
          onCommentChange={setComment}
          onClose={() => setReviewWFH(null)}
          onApprove={() => handleWFHReview('Approved')}
          onReject={() => handleWFHReview('Rejected')}
          submitting={submitting}
        />
      )}

      {/* Review Regularization Modal */}
      {reviewReg && (
        <ReviewModal
          title="Review Regularization"
          details={[
            { label: 'Date', value: new Date(reviewReg.date).toLocaleDateString() },
            { label: 'Status', value: reviewReg.status },
            { label: 'Reason', value: reviewReg.regularizationReason || '—' },
          ]}
          comment={comment}
          onCommentChange={setComment}
          onClose={() => setReviewReg(null)}
          onApprove={() => handleRegReview('Approved')}
          onReject={() => handleRegReview('Rejected')}
          submitting={submitting}
        />
      )}
    </div>
  );
}
