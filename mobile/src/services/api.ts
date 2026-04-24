/**
 * Mobile app REST client — connects to the HRMS backend
 *
 * Prefers EXPO_PUBLIC_API_BASE_URL when provided, then falls back to common
 * local-dev hosts for physical devices and emulators.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

function getMetroBaseUrl(): string | undefined {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (!scriptURL) return undefined;

  // Handle both http:// and exp:// schemes (Expo Go uses exp://192.x.x.x:8081)
  const match = scriptURL.match(/^(?:https?|exp):\/\/([^/:]+)(?::\d+)?/);
  const host = match?.[1];
  if (!host || host === 'localhost') return undefined;
  return `http://${host}:5000/api`;
}

const platformFallbacks = Platform.select({
  android: ['http://10.0.2.2:5000/api'],
  ios: ['http://127.0.0.1:5000/api'],
  default: [],
}) as string[];

const PRODUCTION_URL = 'https://smarthrms-backend-fggdhde8dvfheygd.centralindia-01.azurewebsites.net/api';

const API_BASE_CANDIDATES = Array.from(
  new Set(
    [
      process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || PRODUCTION_URL,
      getMetroBaseUrl(),
      ...platformFallbacks,
    ].filter(Boolean)
  )
) as string[];

export const API_BASE_URL = API_BASE_CANDIDATES[0];

const TIMEOUT_MS = 15000;

function fetchWithTimeout(url: string, opts: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('accessToken');
}

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('network request failed')
    || message.includes('failed to fetch')
    || message.includes('abort')
    || message.includes('timed out')
  );
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: object,
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let lastError: unknown;

  for (const baseUrl of API_BASE_CANDIDATES) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      return json as T;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      lastError = error;
    }
  }

  throw new Error(
    `Unable to reach backend. Tried: ${API_BASE_CANDIDATES.join(', ')}${
      lastError instanceof Error && lastError.message ? ` (${lastError.message})` : ''
    }`
  );
}

export const api = {
  get:    <T>(path: string)              => request<T>('GET',    path),
  post:   <T>(path: string, body: object) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: object) => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: object) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)              => request<T>('DELETE',  path),
};

// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function loginWithCredentials(email: string, password: string) {
  const data = await api.post<{
    accessToken: string;
    refreshToken?: string;
    user: { id: string; name: string; email: string; role: string };
  }>('/auth/login', { email, password });
  await AsyncStorage.setItem('accessToken', data.accessToken);
  if (data.refreshToken) await AsyncStorage.setItem('refreshToken', data.refreshToken);
  return data;
}

export async function logoutApi() {
  try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
}

export async function getMe() {
  return api.get<{ user: { id: string; name: string; email: string; role: string } }>('/auth/me');
}

// ── Attendance helpers ────────────────────────────────────────────────────────
export async function getTodayStatus() {
  return api.get<{
    log: {
      id: string; punchIn?: string; punchOut?: string;
      workHours?: number; status: string; attendanceMode?: string;
    } | null;
    isPunchedIn: boolean;
    isPunchedOut: boolean;
    shiftStart: string;
  }>('/attendance/today-status');
}

export async function punchIn(opts: { attendanceMode?: string; lat?: number; lng?: number }) {
  return api.post<{ message: string; status: string; lateByMinutes: number }>('/attendance/punch-in', opts);
}

export async function punchOut(opts: { lat?: number; lng?: number }) {
  return api.post<{ message: string; workHours: number; status: string }>('/attendance/punch-out', opts);
}

export async function getAttendanceLogs(employeeId: string, month: number, year: number) {
  return api.get<{
    logs: Array<{
      id: string; date: string; punchIn?: string; punchOut?: string;
      workHours?: number; status: string; attendanceMode?: string;
    }>;
    month: number; year: number;
  }>(`/attendance/employee/${employeeId}?month=${month}&year=${year}`);
}

// Push raw eSSL punches to backend → saved to PostgreSQL
export async function pushEsslPunches(
  punches: Array<{ empCode: string; timestamp: string; direction: 'in' | 'out' }>
): Promise<{ saved: number; skipped: number; total: number }> {
  return api.post<{ success: boolean; saved: number; skipped: number; total: number }>(
    '/attendance/push-punches',
    { punches }
  );
}

// Get live attendance feed from PostgreSQL (today's logs)
export async function getLiveFeed(): Promise<{
  feed: Array<{
    id: string; empCode: string; name: string; department: string;
    punchIn: string | null; punchOut: string | null;
    workHours: number | null; status: string; source: string;
  }>;
  date: string;
  total: number;
}> {
  return api.get('/attendance/live-feed');
}

// ── Employee helpers ──────────────────────────────────────────────────────────
export async function getMyEmployee() {
  return api.get<{ data: Array<{ id: string; employeeId: string; department: string; designation: string }> }>(
    '/employees?limit=1'
  );
}

// ── Leave helpers ─────────────────────────────────────────────────────────────
export async function getLeaves(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return api.get<Array<{ id: string; fromDate: string; toDate: string; status: string; reason: string }>>(`/leaves${qs}`);
}

export async function applyLeave(body: { leaveTypeId: string; fromDate: string; toDate: string; reason: string }) {
  return api.post('/leaves', body);
}

// ── WFH helpers ──────────────────────────────────────────────────────────────
export interface WFHRequestAPI {
  id: string;
  date: string;      // ISO string
  mode: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export async function getMyWFHRequests(status?: string): Promise<WFHRequestAPI[]> {
  const qs = status ? `?status=${status}` : '';
  return api.get<WFHRequestAPI[]>(`/attendance/wfh-requests${qs}`);
}

export async function submitWFHRequest(body: { date: string; mode: string; reason: string }) {
  return api.post('/attendance/wfh-request', body);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AttendanceLogAPI {
  id: string;
  date: string;
  punchIn?: string | null;
  punchOut?: string | null;
  workHours?: number | null;
  status: string;
  attendanceMode?: string | null;
  source?: string;
}

export interface AttendanceByDateEntry {
  id: string;
  date: string;
  empCode: string;
  employeeDbId: string;
  name: string;
  department: string;
  punchIn: string | null;
  punchOut: string | null;
  workHours: number | null;
  status: string;
  source: string;
}

export interface EmployeeAPI {
  id: string;
  employeeId: string;
  department: string;
  designation: string;
  phone?: string | null;
  address?: string | null;
  joinDate?: string;
  isActive: boolean;
  user?: { id: string; name: string; email: string; role: string; department: string };
}

export interface LeaveBalanceAPI {
  id: string;
  leaveTypeId: string;
  year: number;
  allocated: number;
  used: number;
  remaining: number;
  leaveType?: { name: string };
}

export interface LeaveRequestAPI {
  id: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: string;
  reason: string;
  reviewComment?: string | null;
  leaveType?: { name: string };
  employee?: { employeeId: string; user?: { name: string; email: string } };
}

// ── Attendance by employee (monthly log) ─────────────────────────────────────
export async function getAttendanceByEmployee(
  employeeId: string,
  month: number,
  year: number,
): Promise<{ logs: AttendanceLogAPI[]; month: number; year: number }> {
  return api.get(`/attendance/employee/${employeeId}?month=${month}&year=${year}`);
}

// ── Attendance by date/range (HR/Manager view) ───────────────────────────────
export async function getAttendanceByDate(
  opts: { date: string } | { from: string; to: string },
): Promise<{ feed: AttendanceByDateEntry[]; from: string; to: string; total: number }> {
  const qs = 'date' in opts
    ? `?date=${opts.date}`
    : `?from=${opts.from}&to=${opts.to}`;
  return api.get(`/attendance/by-date${qs}`);
}

// ── Monthly report summary (HR view) ─────────────────────────────────────────
export async function getMonthlyReport(
  month: number,
  year: number,
  department?: string,
): Promise<{
  summary: Array<{
    _id: string; employeeId: string; name: string; department: string;
    present: number; late: number; absent: number; leave: number;
    weeklyOff: number; holiday: number; halfDay: number;
    totalWorkHours: string; total: number;
  }>;
  month: number; year: number;
}> {
  const qs = department ? `?month=${month}&year=${year}&department=${encodeURIComponent(department)}` : `?month=${month}&year=${year}`;
  return api.get(`/attendance/monthly-summary${qs}`);
}

// ── Employee list ─────────────────────────────────────────────────────────────
export async function getEmployees(params?: {
  page?: number; limit?: number; search?: string; department?: string; status?: string;
}): Promise<{ data: EmployeeAPI[]; total: number; page: number; limit: number; pages: number }> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.search) q.set('search', params.search);
  if (params?.department) q.set('department', params.department);
  if (params?.status) q.set('status', params.status);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return api.get(`/employees${qs}`);
}

// ── Employee profile (own) ────────────────────────────────────────────────────
export async function getEmployeeProfile(): Promise<EmployeeAPI> {
  return api.get('/employees/profile');
}

// ── Leave balance ─────────────────────────────────────────────────────────────
export async function getLeaveBalance(employeeId: string): Promise<LeaveBalanceAPI[]> {
  return api.get(`/leaves/balance/${employeeId}`);
}

// ── Leave requests (HR sees all, Employee sees own) ───────────────────────────
export async function getLeaveRequests(status?: string): Promise<LeaveRequestAPI[]> {
  const qs = status ? `?status=${status}` : '';
  return api.get(`/leaves${qs}`);
}

// ── Review leave (HR/Admin) ───────────────────────────────────────────────────
export async function reviewLeave(
  id: string,
  status: 'Approved' | 'Rejected',
  comment?: string,
): Promise<{ message: string }> {
  return api.put(`/leaves/${id}/review`, { status, comment });
}

