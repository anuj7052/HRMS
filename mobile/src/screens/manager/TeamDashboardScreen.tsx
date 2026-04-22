import React, { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Badge, Card, Row, SectionHeader } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';

const TeamDashboardScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const mgr = useAppSelector((s) => s.auth.user)!;
  const employees = useAppSelector((s) => s.data.employees.filter((e) => e.managerId === mgr.id));
  const attendance = useAppSelector((s) => s.data.attendance);
  const wfh = useAppSelector((s) => s.data.wfhRequests);
  const leaves = useAppSelector((s) => s.data.leaves);

  const today = new Date().toISOString().split('T')[0];

  const statusOf = (uid: string) => {
    const rec = attendance.find((a) => a.userId === uid && a.date === today);
    if (rec) return rec.status;
    if (leaves.find((l) => l.userId === uid && l.status === 'Approved' && today >= l.from && today <= l.to)) return 'Leave';
    if (wfh.find((w) => w.userId === uid && w.status === 'Approved' && w.dates.includes(today))) return 'WFH';
    return 'Absent';
  };

  const teamStatus = employees.map((e) => ({ ...e, status: statusOf(e.id) }));
  const counts = useMemo(() => {
    const c = { Present: 0, WFH: 0, Leave: 0, Absent: 0 } as Record<string, number>;
    teamStatus.forEach((e) => ((c as any)[e.status] = ((c as any)[e.status] ?? 0) + 1));
    return c;
  }, [teamStatus]);

  const attnPct = employees.length > 0 ? Math.round(((counts.Present + counts.WFH) / employees.length) * 100) : 0;
  const pendingCount =
    wfh.filter((w) => employees.find((e) => e.id === w.userId) && w.status === 'Pending').length +
    leaves.filter((l) => employees.find((e) => e.id === l.userId) && l.status === 'Pending').length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Row style={{ gap: 10 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Team size</Text>
          <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{employees.length}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Attendance %</Text>
          <Text style={{ color: t.colors.success, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{attnPct}%</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Pending</Text>
          <Text style={{ color: t.colors.warning, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{pendingCount}</Text>
        </Card>
      </Row>

      <SectionHeader title="Today's breakdown" />
      <Card>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Badge label={`Present: ${counts.Present ?? 0}`} color={palette.present} />
          <Badge label={`WFH: ${counts.WFH ?? 0}`} color={palette.wfh} />
          <Badge label={`On Leave: ${counts.Leave ?? 0}`} color={palette.leave} />
          <Badge label={`Absent: ${counts.Absent ?? 0}`} color={palette.absent} />
        </Row>
      </Card>

      <SectionHeader
        title="Team members"
        action={
          <Pressable onPress={() => navigation.navigate('Approvals')}>
            <Text style={{ color: t.colors.primary, fontWeight: '600' }}>Approvals →</Text>
          </Pressable>
        }
      />
      <FlatList
        data={teamStatus}
        scrollEnabled={false}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('TeamMemberDetail', { userId: item.id })}>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <Avatar name={item.name} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ color: t.colors.text, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {item.designation} · {item.workMode}
                    </Text>
                  </View>
                </Row>
                <Badge label={item.status} color={statusColor(item.status, t)} />
              </Row>
            </Card>
          </Pressable>
        )}
      />
    </ScrollView>
  );
};

export default TeamDashboardScreen;
