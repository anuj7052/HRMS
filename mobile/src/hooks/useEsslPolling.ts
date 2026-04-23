import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchPunches } from '@/services/essl';
import { pushEsslPunches } from '@/services/api';
import { ingestPunches, setConnected, setError, EsslPunch } from '@/store/esslSlice';
import { checkIn, checkOut } from '@/store/dataSlice';

const MAX_BACKOFF_MS = 60_000;   // cap at 1 minute between retries when errors persist
const BACKOFF_MULTIPLIER = 2;    // double the interval on each consecutive error

/**
 * Polls the eSSL proxy every `config.pollMs` (default 5s) when `enabled === true`.
 * After each successful fetch:
 *   1. Punches are stored in Redux (`essl.recent`) for live UI
 *   2. Punches are pushed to the backend → saved to PostgreSQL
 *   3. Attendance checkIn/checkOut events are mirrored into `data.attendance`
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
        dispatch(setError(result.error || 'Poll failed'));
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

        // ── Save to PostgreSQL via backend ──────────────────────────────
        if (result.punches.length > 0) {
          const newPunches = result.punches.filter((p) => !seenIds.current.has(p.id));
          if (newPunches.length > 0) {
            pushEsslPunches(
              newPunches.map((p) => ({
                empCode: p.empCode,
                timestamp: p.timestamp,
                direction: p.direction,
              }))
            ).catch(() => { /* silent — offline/no token is fine */ });
          }
        }

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

    consecutiveErrors.current = 0;
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, config.proxyUrl, config.serverUrl, config.userName, config.password, config.pollMs, dispatch, employees]);
}

