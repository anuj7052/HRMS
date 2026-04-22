import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchPunches } from '@/services/essl';
import { ingestPunches, setConnected, setError, EsslPunch } from '@/store/esslSlice';
import { checkIn, checkOut } from '@/store/dataSlice';

const MAX_BACKOFF_MS = 60_000;   // cap at 1 minute between retries when errors persist
const BACKOFF_MULTIPLIER = 2;    // double the interval on each consecutive error

/**
 * Polls the proxy every `config.pollMs` (default 5s) when `enabled === true`.
 * Uses exponential backoff when errors occur to avoid hammering a unreachable server.
 * Punches received are:
 *   1. stored in `essl.recent`
 *   2. mirrored into `data.attendance` via checkIn / checkOut so the UI updates everywhere.
 */
export function useEsslPolling() {
  const dispatch = useAppDispatch();
  const enabled = useAppSelector((s) => s.essl.enabled);
  const config = useAppSelector((s) => s.essl.config);
  const employees = useAppSelector((s) => s.data.employees);
  const seenIds = useRef<Set<string>>(new Set());
  const consecutiveErrors = useRef(0);

  useEffect(() => {
    if (!enabled || !config.proxyUrl || !config.serverUrl) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      const result = await fetchPunches(config);
      if (cancelled) return;

      if (!result.ok) {
        consecutiveErrors.current += 1;
        // Only surface the error on the first failure; subsequent ones are silently retried
        dispatch(setError(result.error || 'Poll failed'));
        // Exponential backoff: 5s → 10s → 20s → 40s → 60s (cap)
        const backoff = Math.min(
          config.pollMs * Math.pow(BACKOFF_MULTIPLIER, consecutiveErrors.current - 1),
          MAX_BACKOFF_MS
        );
        if (!cancelled) timer = setTimeout(tick, backoff);
      } else {
        consecutiveErrors.current = 0;
        dispatch(setConnected(true));
        dispatch(ingestPunches(result.punches));
        applyToAttendance(result.punches);
        if (!cancelled) timer = setTimeout(tick, Math.max(1000, config.pollMs));
      }
    };

    const applyToAttendance = (punches: EsslPunch[]) => {
      for (const p of punches) {
        if (seenIds.current.has(p.id)) continue;
        seenIds.current.add(p.id);
        const emp = employees.find((e) => e.empCode === p.empCode);
        if (!emp) continue;
        const time = p.timestamp.split(' ')[1]?.slice(0, 5);
        if (!time) continue;
        if (p.direction === 'out') {
          dispatch(checkOut({ userId: emp.id, time }));
        } else {
          dispatch(checkIn({ userId: emp.id, time, source: 'ESSL' }));
        }
      }
    };

    // Reset backoff counter when polling starts fresh
    consecutiveErrors.current = 0;
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, config.proxyUrl, config.serverUrl, config.userName, config.password, config.pollMs, dispatch, employees]);
}
