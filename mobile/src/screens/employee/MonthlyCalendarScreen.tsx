import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge, Card, Row } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';
import { getAttendanceByEmployee, getEmployees, type AttendanceLogAPI } from '@/services/api';
import { AttendanceStatus } from '@/types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const MonthlyCalendarScreen: React.FC = () => {
  const t = useTheme();
  const employeeDbId = useAppSelector((s) => s.auth.employeeDbId);
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [logs, setLogs] = useState<AttendanceLogAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [empId, setEmpId] = useState<string | null>(employeeDbId);

  useEffect(() => {
    if (!empId) {
      getEmployees({ limit: 1 }).then((r) => setEmpId(r.data?.[0]?.id ?? null)).catch(() => {});
    }
  }, [empId]);

  const fetchLogs = useCallback(async () => {
    if (!empId) return;
    setLoading(true);
    try {
      const res = await getAttendanceByEmployee(empId, cur.m + 1, cur.y);
      setLogs(res.logs);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [empId, cur.m, cur.y]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const map = useMemo(() => {
    const o: Record<string, AttendanceStatus> = {};
    logs.forEach((a) => {
      const key = isoDate(new Date(a.date));
      o[key] = a.status as AttendanceStatus;
    });
    return o;
  }, [logs]);

  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const startWeekday = new Date(cur.y, cur.m, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const statusOf = (d: number): AttendanceStatus => {
    const mm = String(cur.m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const key = `${cur.y}-${mm}-${dd}`;
    if (map[key]) return map[key];
    const dow = new Date(cur.y, cur.m, d).getDay();
    return dow === 0 || dow === 6 ? 'Weekend' : 'Absent';
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { Present: 0, WFH: 0, Leave: 0, Absent: 0, Holiday: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const s = statusOf(d);
      if (s in c) c[s]++;
    }
    return c;
  }, [cur, map]);

  const prev = () => { const d = new Date(cur.y, cur.m - 1, 1); setCur({ y: d.getFullYear(), m: d.getMonth() }); };
  const next = () => { const d = new Date(cur.y, cur.m + 1, 1); if (d <= new Date()) setCur({ y: d.getFullYear(), m: d.getMonth() }); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Pressable onPress={prev} style={{ padding: 8 }}>
            <Text style={{ color: t.colors.primary, fontWeight: '700', fontSize: 18 }}>‹</Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 16 }}>
              {MONTHS[cur.m]} {cur.y}
            </Text>
            {loading && <ActivityIndicator color={t.colors.primary} size="small" style={{ marginTop: 4 }} />}
          </View>
          <Pressable onPress={next} style={{ padding: 8 }}>
            <Text style={{ color: t.colors.primary, fontWeight: '700', fontSize: 18 }}>›</Text>
          </Pressable>
        </Row>

        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.colors.textMuted, fontWeight: '600' }}>{d}</Text>
          ))}
        </Row>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (d === null) return <View key={i} style={{ width: `${100/7}%`, aspectRatio: 1 }} />;
            const s = statusOf(d);
            const c = statusColor(s, t);
            return (
              <View key={i} style={{ width: `${100/7}%`, aspectRatio: 1, padding: 3 }}>
                <View style={{
                  flex: 1, backgroundColor: c + '22', borderRadius: 8,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: c + '55',
                }}>
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>{d}</Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c, marginTop: 3 }} />
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 12 }}>This Month Summary</Text>
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {(['Present','WFH','Leave','Absent','Holiday'] as AttendanceStatus[]).map((s) => (
            <Badge key={s} label={`${s}: ${counts[s] ?? 0}`} color={statusColor(s, t)} />
          ))}
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 12 }}>Legend</Text>
        <Row style={{ flexWrap: 'wrap', gap: 10 }}>
          {[
            { k: 'Present', c: palette.present },
            { k: 'WFH', c: palette.wfh },
            { k: 'Leave', c: palette.leave },
            { k: 'Absent', c: palette.absent },
            { k: 'Holiday', c: palette.holiday },
          ].map((l) => (
            <Row key={l.k} style={{ gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: l.c }} />
              <Text style={{ color: t.colors.text, fontSize: 13 }}>{l.k}</Text>
            </Row>
          ))}
        </Row>
      </Card>
    </ScrollView>
  );
};

export default MonthlyCalendarScreen;
