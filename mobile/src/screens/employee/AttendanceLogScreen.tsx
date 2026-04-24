import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, Row } from '@/components/UI';
import { statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';
import { getAttendanceByEmployee, getEmployees, type AttendanceLogAPI } from '@/services/api';

const FILTERS = ['All', 'Present', 'WFH', 'Leave', 'Absent'] as const;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtTime(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const AttendanceLogScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const employeeDbId = useAppSelector((s) => s.auth.employeeDbId);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [logs, setLogs] = useState<AttendanceLogAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [empId, setEmpId] = useState<string | null>(employeeDbId);

  // Resolve employee DB ID if not yet stored
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

  const records = useMemo(() => {
    if (filter === 'All') return logs;
    return logs.filter((a) => a.status === filter);
  }, [logs, filter]);

  const prev = () => {
    const d = new Date(cur.y, cur.m - 1, 1);
    setCur({ y: d.getFullYear(), m: d.getMonth() });
  };
  const next = () => {
    const d = new Date(cur.y, cur.m + 1, 1);
    if (d <= new Date()) setCur({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, padding: 16 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 18 }}>Attendance Log</Text>
        <Pressable
          onPress={() => navigation.navigate('MonthlyCalendar')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="calendar-outline" size={18} color={t.colors.primary} />
          <Text style={{ color: t.colors.primary, fontWeight: '600' }}>Calendar</Text>
        </Pressable>
      </Row>

      {/* Month picker */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Pressable onPress={prev} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={20} color={t.colors.primary} />
        </Pressable>
        <Text style={{ color: t.colors.text, fontWeight: '700' }}>
          {MONTHS[cur.m]} {cur.y}
        </Text>
        <Pressable onPress={next} style={{ padding: 8 }}>
          <Ionicons name="chevron-forward" size={20} color={t.colors.primary} />
        </Pressable>
      </Row>

      <Row style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              backgroundColor: filter === f ? t.colors.primary : t.colors.surface,
              borderWidth: 1, borderColor: filter === f ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: filter === f ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 13 }}>{f}</Text>
          </Pressable>
        ))}
      </Row>

      {loading ? (
        <ActivityIndicator color={t.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(a) => a.id}
          ListEmptyComponent={<EmptyState title="No records" subtitle="No attendance records for this period." />}
          contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
          renderItem={({ item }) => {
            const checkIn = fmtTime(item.punchIn);
            const checkOut = fmtTime(item.punchOut);
            const dateStr = new Date(item.date).toDateString();
            return (
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: t.colors.text, fontWeight: '700' }}>{dateStr}</Text>
                    <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      {checkIn} – {checkOut} · {item.workHours?.toFixed(1) ?? '0.0'} hrs · {item.source ?? 'ESSL'}
                    </Text>
                    {item.attendanceMode && item.attendanceMode !== 'WFO' && (
                      <Row style={{ marginTop: 8, gap: 6 }}>
                        <Badge label={item.attendanceMode} color={t.colors.info} />
                      </Row>
                    )}
                  </View>
                  <Badge label={item.status} color={statusColor(item.status as any, t)} />
                </Row>
              </Card>
            );
          }}
        />
      )}

      <Pressable
        onPress={() => navigation.navigate('CorrectionRequest')}
        style={{
          position: 'absolute', right: 16, bottom: 24,
          backgroundColor: t.colors.primary,
          paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999,
          flexDirection: 'row', alignItems: 'center', gap: 6,
        }}
      >
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700' }}>Correction</Text>
      </Pressable>
    </View>
  );
};

export default AttendanceLogScreen;
