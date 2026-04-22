import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge, Card, Row, SectionHeader, Button } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';

type Range = 'daily' | 'weekly' | 'monthly';

const AttendanceReportsScreen: React.FC = () => {
  const t = useTheme();
  const [range, setRange] = useState<Range>('monthly');
  const [dept, setDept] = useState<string>('All');
  const employees = useAppSelector((s) => s.data.employees);
  const attendance = useAppSelector((s) => s.data.attendance);

  const departments = ['All', ...Array.from(new Set(employees.map((e) => e.department)))];

  const days = range === 'daily' ? 1 : range === 'weekly' ? 7 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const filtered = useMemo(() => {
    const empSet = new Set(dept === 'All' ? employees.map((e) => e.id) : employees.filter((e) => e.department === dept).map((e) => e.id));
    return attendance.filter((a) => empSet.has(a.userId) && new Date(a.date) >= since);
  }, [attendance, employees, dept, range]);

  const counts = {
    Present: filtered.filter((a) => a.status === 'Present').length,
    WFH: filtered.filter((a) => a.status === 'WFH').length,
    Leave: filtered.filter((a) => a.status === 'Leave').length,
    Absent: filtered.filter((a) => a.status === 'Absent').length,
  };

  const total = Math.max(1, Object.values(counts).reduce((s, n) => s + n, 0));

  const deptStats = useMemo(() => {
    const map: Record<string, { present: number; total: number }> = {};
    employees.forEach((e) => {
      map[e.department] = map[e.department] ?? { present: 0, total: 0 };
    });
    filtered.forEach((a) => {
      const emp = employees.find((e) => e.id === a.userId);
      if (!emp) return;
      const m = map[emp.department];
      m.total++;
      if (a.status === 'Present' || a.status === 'WFH') m.present++;
    });
    return Object.entries(map).map(([k, v]) => ({ dept: k, pct: v.total ? Math.round((v.present / v.total) * 100) : 0 }));
  }, [filtered, employees]);

  const Bar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
    const pct = (value / total) * 100;
    return (
      <View style={{ marginBottom: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: t.colors.text, fontWeight: '600' }}>{label}</Text>
          <Text style={{ color: t.colors.textMuted }}>{value}</Text>
        </Row>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: t.colors.surfaceAlt, marginTop: 6, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Row style={{ backgroundColor: t.colors.surfaceAlt, borderRadius: 10, padding: 4, marginBottom: 12 }}>
        {(['daily', 'weekly', 'monthly'] as Range[]).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: range === r ? t.colors.surface : 'transparent',
            }}
          >
            <Text style={{ color: range === r ? t.colors.primary : t.colors.textMuted, fontWeight: '600', textTransform: 'capitalize' }}>{r}</Text>
          </Pressable>
        ))}
      </Row>

      <Row style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {departments.map((d) => (
          <Pressable
            key={d}
            onPress={() => setDept(d)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: dept === d ? t.colors.primary : t.colors.surface,
              borderWidth: 1,
              borderColor: dept === d ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: dept === d ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 13 }}>{d}</Text>
          </Pressable>
        ))}
      </Row>

      <Card>
        <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 10 }}>Attendance breakdown</Text>
        <Bar label="Present" value={counts.Present} color={palette.present} />
        <Bar label="WFH" value={counts.WFH} color={palette.wfh} />
        <Bar label="Leave" value={counts.Leave} color={palette.leave} />
        <Bar label="Absent" value={counts.Absent} color={palette.absent} />
      </Card>

      <SectionHeader title="Department-wise attendance %" />
      <Card>
        {deptStats.map((d) => (
          <View key={d.dept} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: t.colors.text, fontWeight: '600' }}>{d.dept}</Text>
              <Text style={{ color: t.colors.success, fontWeight: '700' }}>{d.pct}%</Text>
            </Row>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.surfaceAlt, marginTop: 6, overflow: 'hidden' }}>
              <View style={{ width: `${d.pct}%`, height: '100%', backgroundColor: palette.present }} />
            </View>
          </View>
        ))}
      </Card>

      <SectionHeader title="Recent records" />
      {filtered.slice(0, 10).map((a) => {
        const emp = employees.find((e) => e.id === a.userId);
        return (
          <Card key={a.id} style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{emp?.name}</Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {a.date} · {a.checkIn || '--:--'}–{a.checkOut || '--:--'} · {a.source}
                </Text>
              </View>
              <Badge label={a.status} color={statusColor(a.status, t)} />
            </Row>
          </Card>
        );
      })}

      <View style={{ marginTop: 12 }}>
        <Button
          title="Export as CSV / Excel"
          variant="secondary"
          onPress={() => Alert.alert('Exported', 'Report exported to your email (mock).')}
        />
      </View>
    </ScrollView>
  );
};

export default AttendanceReportsScreen;
