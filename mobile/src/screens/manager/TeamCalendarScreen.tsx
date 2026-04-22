import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Badge, Card, Row, SectionHeader } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';

const TeamCalendarScreen: React.FC = () => {
  const t = useTheme();
  const mgr = useAppSelector((s) => s.auth.user)!;
  const team = useAppSelector((s) =>
    mgr.role === 'hr' ? s.data.employees : s.data.employees.filter((e) => e.managerId === mgr.id)
  );
  const attendance = useAppSelector((s) => s.data.attendance);
  const [selected, setSelected] = useState(team[0]?.id);

  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d;
  });

  const statusFor = (uid: string, iso: string) => attendance.find((a) => a.userId === uid && a.date === iso)?.status;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>Select member</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {team.map((e) => (
          <Pressable key={e.id} onPress={() => setSelected(e.id)}>
            <View
              style={{
                alignItems: 'center',
                padding: 10,
                borderRadius: 12,
                backgroundColor: selected === e.id ? t.colors.primary + '18' : t.colors.surface,
                borderWidth: 1,
                borderColor: selected === e.id ? t.colors.primary : t.colors.border,
                minWidth: 80,
              }}
            >
              <Avatar name={e.name} size={42} />
              <Text style={{ color: t.colors.text, fontWeight: '600', marginTop: 6, fontSize: 12 }}>{e.name.split(' ')[0]}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeader title="Last 14 days" />
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {days.map((d, i) => {
            const iso = d.toISOString().split('T')[0];
            const s = selected ? statusFor(selected, iso) : undefined;
            const color = s ? statusColor(s, t) : t.colors.surfaceAlt;
            return (
              <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}>
                <View
                  style={{
                    flex: 1,
                    borderRadius: 8,
                    backgroundColor: s ? color + '22' : t.colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: s ? color + '55' : t.colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>{d.getDate()}</Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 9 }}>{d.toLocaleDateString('en', { month: 'short' })}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      <SectionHeader title="Legend" />
      <Card>
        <Row style={{ flexWrap: 'wrap', gap: 10 }}>
          {[
            { k: 'Present', c: palette.present },
            { k: 'WFH', c: palette.wfh },
            { k: 'Leave', c: palette.leave },
            { k: 'Absent', c: palette.absent },
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

export default TeamCalendarScreen;
