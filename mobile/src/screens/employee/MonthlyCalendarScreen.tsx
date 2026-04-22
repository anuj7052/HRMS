import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Badge, Card, Row } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';
import { AttendanceStatus } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MonthlyCalendarScreen: React.FC = () => {
  const t = useTheme();
  const user = useAppSelector((s) => s.auth.user)!;
  const attendance = useAppSelector((s) => s.data.attendance);
  const holidays = useAppSelector((s) => s.data.holidays);
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const map = useMemo(() => {
    const o: Record<string, AttendanceStatus> = {};
    attendance.filter((a) => a.userId === user.id).forEach((a) => (o[a.date] = a.status));
    holidays.forEach((h) => {
      if (!o[h.date]) o[h.date] = 'Holiday';
    });
    return o;
  }, [attendance, user.id, holidays]);

  const first = new Date(cur.y, cur.m, 1);
  const daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
  const startWeekday = first.getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const iso = (d: number) => {
    const mm = String(cur.m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${cur.y}-${mm}-${dd}`;
  };

  const statusOf = (d: number): AttendanceStatus => {
    const key = iso(d);
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
  }, [cur]);

  const prev = () => {
    const d = new Date(cur.y, cur.m - 1, 1);
    setCur({ y: d.getFullYear(), m: d.getMonth() });
  };
  const next = () => {
    const d = new Date(cur.y, cur.m + 1, 1);
    setCur({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Pressable onPress={prev} style={{ padding: 8 }}>
            <Text style={{ color: t.colors.primary, fontWeight: '700' }}>‹</Text>
          </Pressable>
          <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 16 }}>
            {MONTHS[cur.m]} {cur.y}
          </Text>
          <Pressable onPress={next} style={{ padding: 8 }}>
            <Text style={{ color: t.colors.primary, fontWeight: '700' }}>›</Text>
          </Pressable>
        </Row>

        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.colors.textMuted, fontWeight: '600' }}>
              {d}
            </Text>
          ))}
        </Row>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (d === null) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const s = statusOf(d);
            const c = statusColor(s, t);
            return (
              <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: c + '22',
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: c + '55',
                  }}
                >
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
          {(['Present', 'WFH', 'Leave', 'Absent', 'Holiday'] as AttendanceStatus[]).map((s) => (
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
