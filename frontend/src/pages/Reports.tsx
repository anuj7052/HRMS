import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface Summary {
  employeeId: string;
  name: string;
  department: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  totalWorkHours: string;
}

interface DailyPoint {
  date: string;
  present: number;
  late: number;
  absent: number;
}

export default function ReportsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  useEffect(() => {
    api.get<string[]>('/employees/departments').then((r: { data: string[] }) => setDepartments(r.data));
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/monthly', { params: { month, year, department: department || undefined } });
      setSummary(res.data.summary);
      setDaily(res.data.dailyBreakdown);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [month, year, department]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  async function exportFile(type: 'csv' | 'pdf') {
    setExporting(type);
    try {
      const res = await api.get(`/reports/export/${type}`, {
        params: { month, year, department: department || undefined },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${year}_${month}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Export failed`);
    } finally {
      setExporting(null);
    }
  }

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <div className="flex gap-2">
          <button onClick={() => exportFile('csv')} disabled={!!exporting} className="btn-secondary flex items-center gap-2 text-sm">
            {exporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            CSV
          </button>
          <button onClick={() => exportFile('pdf')} disabled={!!exporting} className="btn-secondary flex items-center gap-2 text-sm">
            {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-gray-800 dark:text-white min-w-[120px] text-center">{monthName} {year}</span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <select className="input max-w-xs" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Chart */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Daily Attendance — {monthName} {year}</h2>
        {loading ? (
          <div className="skeleton h-48 rounded-xl" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={daily.filter((_, i) => i % 2 === 0)} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => new Date(v).getDate().toString()} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleDateString()} />
              <Legend />
              <Bar dataKey="present" fill="#10B981" name="Present" radius={[3, 3, 0, 0]} />
              <Bar dataKey="late" fill="#F59E0B" name="Late" radius={[3, 3, 0, 0]} />
              <Bar dataKey="absent" fill="#EF4444" name="Absent" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Employee Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Employee</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden sm:table-cell">Department</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-center">Present</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-center">Late</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-center">Absent</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-center hidden md:table-cell">Leave</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400 text-right hidden lg:table-cell">Work Hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded" /></td>)}</tr>
                ))
              ) : summary.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No data for this period</td></tr>
              ) : summary.map((row) => (
                <tr key={row.employeeId} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{row.name}</p>
                    <p className="text-xs text-gray-500">{row.employeeId}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{row.department}</td>
                  <td className="px-4 py-3 text-center"><span className="badge-green">{row.present}</span></td>
                  <td className="px-4 py-3 text-center"><span className="badge-yellow">{row.late}</span></td>
                  <td className="px-4 py-3 text-center"><span className="badge-red">{row.absent}</span></td>
                  <td className="px-4 py-3 text-center hidden md:table-cell"><span className="badge-blue">{row.leave}</span></td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden lg:table-cell">{row.totalWorkHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
