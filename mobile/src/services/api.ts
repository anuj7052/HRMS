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
