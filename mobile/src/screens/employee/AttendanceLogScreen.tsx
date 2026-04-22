import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, Row } from '@/components/UI';
import { statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';

const FILTERS = ['All', 'Present', 'WFH', 'Leave', 'Absent'] as const;

const AttendanceLogScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const user = useAppSelector((s) => s.auth.user)!;
  const attendance = useAppSelector((s) => s.data.attendance);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const records = useMemo(() => {
    const mine = attendance.filter((a) => a.userId === user.id);
    if (filter === 'All') return mine;
    return mine.filter((a) => a.status === filter);
  }, [attendance, filter, user.id]);

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

      <Row style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: filter === f ? t.colors.primary : t.colors.surface,
              borderWidth: 1,
              borderColor: filter === f ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: filter === f ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 13 }}>{f}</Text>
          </Pressable>
        ))}
      </Row>

      <FlatList
        data={records}
        keyExtractor={(a) => a.id}
        ListEmptyComponent={<EmptyState title="No records" subtitle="No attendance records for this filter." />}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{item.date}</Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                  {item.checkIn || '--:--'} – {item.checkOut || '--:--'} · {item.workingHours?.toFixed(1) ?? '0.0'} hrs · {item.source}
                </Text>
                <Row style={{ marginTop: 8, gap: 6 }}>
                  {item.late && <Badge label="Late" color={t.colors.warning} />}
                  {item.earlyDeparture && <Badge label="Early Out" color={t.colors.warning} />}
                  {item.overtime && <Badge label="Overtime" color={t.colors.info} />}
                </Row>
              </View>
              <Badge label={item.status} color={statusColor(item.status, t)} />
            </Row>
          </Card>
        )}
      />

      <Pressable
        onPress={() => navigation.navigate('CorrectionRequest')}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 24,
          backgroundColor: t.colors.primary,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Ionicons name="create-outline" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700' }}>Correction</Text>
      </Pressable>
    </View>
  );
};

export default AttendanceLogScreen;
