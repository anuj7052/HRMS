import { EsslConfig, EsslPunch } from '@/store/esslSlice';

const join = (base: string, path: string) => base.replace(/\/+$/, '') + path;

const FETCH_TIMEOUT_MS = 12000; // 12s — avoids hanging requests

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

export interface TestResult {
  ok: boolean;
  raw?: string;
  message?: string;
  error?: string;
}

export async function testConnection(cfg: EsslConfig): Promise<TestResult> {
  try {
    const res = await fetchWithTimeout(join(cfg.proxyUrl, '/api/essl/test'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: cfg.mode,
        serverUrl: cfg.serverUrl,
        userName: cfg.userName,
        password: cfg.password,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: !!json.ok, raw: json.raw, message: json.message, error: json.error };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { ok: false, error: 'Request timed out (check proxy URL)' };
    return { ok: false, error: e?.message || 'Network error' };
  }
}

export interface PunchesResult {
  ok: boolean;
  punches: EsslPunch[];
  error?: string;
}

export async function fetchPunches(
  cfg: EsslConfig,
  range?: { fromDate?: string; toDate?: string }
): Promise<PunchesResult> {
  try {
    const res = await fetchWithTimeout(join(cfg.proxyUrl, '/api/essl/punches'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: cfg.mode,
        serverUrl: cfg.serverUrl,
        userName: cfg.userName,
        password: cfg.password,
        ...range,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      return { ok: false, punches: [], error: json.error || `HTTP ${res.status}` };
    }
    return { ok: true, punches: json.punches || [] };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { ok: false, punches: [], error: 'Request timed out (check proxy URL)' };
    return { ok: false, punches: [], error: e?.message || 'Network error' };
  }
}
