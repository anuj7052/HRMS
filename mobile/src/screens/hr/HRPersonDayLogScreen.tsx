/**
 * HRPersonDayLogScreen
 *
 * Shows ALL punch records (check-in / check-out) for a specific employee
 * on a specific date. Fetches fresh data every 5 seconds while screen is open.
 *
 * Route params: { employeeDbId, name, date }
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card, Row } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { getAttendanceByDate, getRawPunches } from '@/services/api';
import type { AttendanceByDateEntry, RawPunchEntry } from '@/services/api';

const pad = (n: number) => String(n).padStart(2, '0');

/** Display time from ISO string — use UTC (eSSL stores IST as UTC on Azure) */
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = pad(d.getUTCMinutes());
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${pad(h12)}:${m} ${ampm}`;
}

function fmtHours(h: number | null | undefined): string {
  if (!h || h <= 0) return '';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

// Duration between two ISO times in hours
function duration(inIso: string | null, outIso: string | null): string {
  if (!inIso || !outIso) return '';
  const diff = (new Date(outIso).getTime() - new Date(inIso).getTime()) / 3600000;
  if (diff <= 0) return '';
  return fmtHours(diff);
}

/** Human-readable punch type label */
function punchLabel(punchType: number): string {
  switch (punchType) {
    case 0: return 'Check In';
    case 1: return 'Check Out';
    case 4: return 'Break Out';
    case 5: return 'Break In';
    default: return 'Punch';
  }
}

function punchIcon(punchType: number): string {
  switch (punchType) {
    case 0: return 'log-in-outline';
    case 1: return 'log-out-outline';
    case 4: return 'cafe-outline';
    case 5: return 'return-up-back-outline';
    default: return 'radio-button-on-outline';
  }
}

function punchColor(punchType: number, primaryColor: string): string {
  switch (punchType) {
    case 0: return '#22C55E';
    case 1: return '#EF4444';
    case 4: return '#F59E0B';
    case 5: return '#3B82F6';
    default: return primaryColor;
  }
}

const REFRESH_INTERVAL = 5000; // 5 seconds

const HRPersonDayLogScreen: React.FC<any> = ({ route, navigation }) => {
  const t = useTheme();
  const { employeeDbId, name, date: routeDate } = route.params as {
    employeeDbId: string;
    name: string;
    date: string;   // YYYY-MM-DD
  };

  const [logs, setLogs] = useState<AttendanceByDateEntry[]>([]);
  const [rawPunches, setRawPunches] = useState<RawPunchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch aggregated attendance log (first-in / last-out summary)
      const res = await getAttendanceByDate({ date: routeDate });
      const mine = res.feed
        .filter((r) => r.employeeDbId === employeeDbId)
        .sort((a, b) => {
          const ta = a.punchIn ? new Date(a.punchIn).getTime() : 0;
          const tb = b.punchIn ? new Date(b.punchIn).getTime() : 0;
          return ta - tb;
        });
      setLogs(mine);

      // Fetch all individual raw punch timestamps from biometric device
      const rawRes = await getRawPunches(employeeDbId, routeDate);
      setRawPunches(rawRes.punches);

      setLastUpdated(new Date());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [employeeDbId, routeDate]);

  // Initial load + 5-second auto-refresh
  useEffect(() => {
    fetchLogs(false);
    intervalRef.current = setInterval(() => fetchLogs(true), REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLogs]);

  // ── Derived summary ────────────────────────────────────────────────────────
  const firstIn  = logs.find((l) => l.punchIn)?.punchIn ?? null;
  const lastOut  = [...logs].reverse().find((l) => l.punchOut)?.punchOut ?? null;
  const totalWorkHours = logs.reduce((sum, l) => sum + (l.workHours ?? 0), 0);
  const status   = logs[0]?.status ?? 'Absent';
  const sc       = (s: string) => statusColor(s as any, t);

  const dateLabel = (() => {
    const d = new Date(routeDate + 'T12:00:00Z');
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
  })();

  if (loading && logs.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={t.colors.primary} />
        <Text style={{ color: t.colors.textMuted, marginTop: 12 }}>Loading punch log…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 14 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Row style={{ flex: 1 }}>
            <Avatar name={name} size={52} />
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 17 }}>{name}</Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 3 }}>{dateLabel}</Text>
            </View>
          </Row>
          <Badge label={status} color={sc(status)} />
        </Row>

        {/* First In / Last Out summary */}
        <Row style={{ gap: 10 }}>
          <View style={{
            flex: 1, backgroundColor: firstIn ? '#22C55E18' : t.colors.surfaceAlt,
            borderRadius: 10, padding: 12, alignItems: 'center',
            borderWidth: 1, borderColor: firstIn ? '#22C55E50' : t.colors.border,
          }}>
            <Ionicons name="log-in-outline" size={18} color={firstIn ? '#22C55E' : t.colors.textMuted} />
            <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 6 }}>First In</Text>
            <Text style={{ color: firstIn ? '#22C55E' : t.colors.textMuted, fontWeight: '900', fontSize: 18, marginTop: 2 }}>
              {fmtTime(firstIn)}
            </Text>
          </View>
          <View style={{
            flex: 1, backgroundColor: lastOut ? '#EF444418' : t.colors.surfaceAlt,
            borderRadius: 10, padding: 12, alignItems: 'center',
            borderWidth: 1, borderColor: lastOut ? '#EF444450' : t.colors.border,
          }}>
            <Ionicons name="log-out-outline" size={18} color={lastOut ? '#EF4444' : t.colors.textMuted} />
            <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 6 }}>Last Out</Text>
            <Text style={{ color: lastOut ? '#EF4444' : t.colors.textMuted, fontWeight: '900', fontSize: 18, marginTop: 2 }}>
              {fmtTime(lastOut)}
            </Text>
          </View>
          {totalWorkHours > 0 && (
            <View style={{
              flex: 1, backgroundColor: t.colors.primary + '15',
              borderRadius: 10, padding: 12, alignItems: 'center',
              borderWidth: 1, borderColor: t.colors.primary + '40',
            }}>
              <Ionicons name="time-outline" size={18} color={t.colors.primary} />
              <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 6 }}>Total</Text>
              <Text style={{ color: t.colors.primary, fontWeight: '900', fontSize: 18, marginTop: 2 }}>
                {fmtHours(totalWorkHours)}
              </Text>
            </View>
          )}
        </Row>
      </Card>

      {/* ── Live indicator ──────────────────────────────────────────────── */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 14 }}>
          All Punches  ({rawPunches.length} event{rawPunches.length !== 1 ? 's' : ''})
        </Text>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />
          <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>LIVE · 5s</Text>
          {lastUpdated && (
            <Text style={{ color: t.colors.textMuted, fontSize: 10 }}>
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          )}
        </Row>
      </Row>

      {/* ── Raw punch timeline ──────────────────────────────────────────── */}
      {rawPunches.length === 0 ? (
        <Card>
          <Text style={{ color: t.colors.textMuted, textAlign: 'center', padding: 20 }}>
            No punch records found for this date
          </Text>
        </Card>
      ) : (
        rawPunches.map((punch, idx) => {
          const isFirst = idx === 0;
          const isLast  = idx === rawPunches.length - 1;
          const color   = punchColor(punch.punchType, t.colors.primary);
          const label   = punchLabel(punch.punchType);
          const icon    = punchIcon(punch.punchType) as any;

          return (
            <View key={punch.id} style={{ marginBottom: 8 }}>
              {/* Timeline connector */}
              {idx > 0 && (
                <View style={{ width: 2, height: 10, backgroundColor: t.colors.border, marginLeft: 28, marginBottom: 0 }} />
              )}
              <Card style={{ borderLeftWidth: 3, borderLeftColor: color }}>
                <Row style={{ alignItems: 'center', gap: 12 }}>
                  {/* Index bubble */}
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: color,
                  }}>
                    <Text style={{ color, fontWeight: '900', fontSize: 12 }}>{idx + 1}</Text>
                  </View>

                  {/* Icon + label */}
                  <View style={{
                    width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: color + '18',
                  }}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {isFirst ? `First · ${label}` : isLast ? `Last · ${label}` : label}
                    </Text>
                    <Text style={{ color: t.colors.text, fontWeight: '900', fontSize: 20, marginTop: 2 }}>
                      {fmtTime(punch.timestamp)}
                    </Text>
                  </View>
                </Row>
              </Card>
            </View>
          );
        })
      )}

      {/* ── View full profile link ────────────────────────────────────── */}
      <Pressable
        onPress={() => navigation.navigate('EmployeeAttendanceProfile', { employeeId: employeeDbId, name })}
        style={{
          marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          paddingVertical: 12, borderRadius: 10,
          backgroundColor: t.colors.primary + '15',
          borderWidth: 1, borderColor: t.colors.primary + '40',
        }}
      >
        <Ionicons name="calendar-outline" size={16} color={t.colors.primary} />
        <Text style={{ color: t.colors.primary, fontWeight: '700' }}>View Full Attendance Profile</Text>
      </Pressable>
    </ScrollView>
  );
};

export default HRPersonDayLogScreen;
