import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Avatar, Badge, Card, Row } from '@/components/UI';
import { statusColor, useTheme } from '@/theme';
import { getAttendanceByEmployee, getEmployees, type AttendanceLogAPI } from '@/services/api';
import { AttendanceStatus } from '@/types';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtTime(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const EmployeeAttendanceProfileScreen: React.FC = () => {
  const t = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();

  // Accept either employeeId (Employee DB UUID) or empCode + name from HRAllAttendanceScreen
  const employeeId: string | undefined = route.params?.employeeId;
  const empCodeParam: string | undefined = route.params?.empCode;
  const nameParam: string | undefined = route.params?.name;

  const [empDbId, setEmpDbId] = useState<string | null>(employeeId ?? null);
  const [empName, setEmpName] = useState<string>(nameParam ?? '');

  const now = new Date();
  const [cur, sCur] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [logs, setLogs] = useState<AttendanceLogAPI[]>([]);
  const [loading, setLoading] = useState(false);

  React.useLayoutEffect(() => {
    nav.setOptions({ title: empName || 'Attendance' });
  }, [nav, empName]);

  // If we have empCode but no DB ID, resolve it
  useEffect(() => {
    if (empDbId) return;
    if (empCodeParam) {
      getEmployees({ search: empCodeParam, limit: 5 })
        .then((r) => {
          const match = r.data.find((e) => e.employeeId === empCodeParam || e.employeeId === empCodeParam.trim());
          if (match) {
            setEmpDbId(match.id);
            if (!empName) setEmpName(match.user.name);
          }
        })
        .catch(() => {});
    }
  }, [empDbId, empCodeParam]);

  const fetchLogs = useCallback(async () => {
    if (!empDbId) return;
    setLoading(true);
    try {
      const res = await getAttendanceByEmployee(empDbId, cur.m + 1, cur.y);
      setLogs(res.logs);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [empDbId, cur.m, cur.y]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Present: 0, WFH: 0, Leave: 0, Absent: 0, Late: 0 };
    logs.forEach((l) => { c[l.status] = (c[l.status] ?? 0) + 1; });
    return c;
  }, [logs]);

  const totalHours = useMemo(() =>
    logs.reduce((s, l) => s + (l.workHours ?? 0), 0).toFixed(1),
    [logs]
  );

  const prev = () => { const d = new Date(cur.y, cur.m - 1, 1); sCur({ y: d.getFullYear(), m: d.getMonth() }); };
  const next = () => {
    const d = new Date(cur.y, cur.m + 1, 1);
    if (d <= new Date()) sCur({ y: d.getFullYear(), m: d.getMonth() });
  };

  if (!empDbId && !empCodeParam) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.background }}>
        <Text style={{ color: t.colors.textMuted }}>Employee not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Header card */}
      <Card style={{ marginBottom: 16 }}>
        <Row style={{ gap: 14 }}>
          <Avatar name={empName || '?'} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 16 }}>{empName || 'Employee'}</Text>
            {empCodeParam && (
              <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>{empCodeParam}</Text>
            )}
          </View>
        </Row>
      </Card>

      {/* Month selector */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Pressable onPress={prev} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={20} color={t.colors.primary} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15 }}>
            {MONTHS[cur.m]} {cur.y}
          </Text>
          {loading && <ActivityIndicator color={t.colors.primary} size="small" style={{ marginTop: 4 }} />}
        </View>
        <Pressable onPress={next} style={{ padding: 8 }}>
          <Ionicons name="chevron-forward" size={20} color={t.colors.primary} />
        </Pressable>
      </Row>

      {/* Summary row */}
      <Card style={{ marginBottom: 16 }}>
        <Row style={{ justifyContent: 'space-around' }}>
          {[
            { label: 'Present', value: counts.Present },
            { label: 'Late',    value: counts.Late },
            { label: 'Absent',  value: counts.Absent },
            { label: 'Leave',   value: counts.Leave },
            { label: 'Hrs',     value: totalHours },
          ].map((s) => (
            <View key={s.label} style={{ alignItems: 'center' }}>
              <Text style={{ color: statusColor(s.label as AttendanceStatus, t), fontWeight: '900', fontSize: 20 }}>{s.value}</Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>{s.label}</Text>
            </View>
          ))}
        </Row>
      </Card>

      {/* Daily log */}
      {loading ? (
        <ActivityIndicator color={t.colors.primary} style={{ marginTop: 20 }} />
      ) : logs.length === 0 ? (
        <Card>
          <Text style={{ color: t.colors.textMuted, textAlign: 'center', padding: 16 }}>No records for this month</Text>
        </Card>
      ) : (
        logs.map((item) => {
          const checkIn = fmtTime(item.punchIn);
          const checkOut = fmtTime(item.punchOut);
          const dateStr = new Date(item.date).toDateString();
          return (
            <Card key={item.id} style={{ marginBottom: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>{dateStr}</Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                    {checkIn} – {checkOut} · {item.workHours?.toFixed(1) ?? '0.0'} hrs · {item.source ?? 'ESSL'}
                  </Text>
                </View>
                <Badge label={item.status} color={statusColor(item.status as any, t)} />
              </Row>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
};

export default EmployeeAttendanceProfileScreen;
