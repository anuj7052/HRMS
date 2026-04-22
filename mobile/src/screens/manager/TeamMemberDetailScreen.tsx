import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Avatar, Badge, Button, Card, EmptyState, Row, SectionHeader } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';

const TeamMemberDetailScreen: React.FC<any> = ({ route }) => {
  const t = useTheme();
  const userId = route.params?.userId;
  const emp = useAppSelector((s) => s.data.employees.find((e) => e.id === userId));
  const attendance = useAppSelector((s) => s.data.attendance.filter((a) => a.userId === userId));
  const leaves = useAppSelector((s) => s.data.leaves.filter((l) => l.userId === userId));
  const wfh = useAppSelector((s) => s.data.wfhRequests.filter((w) => w.userId === userId));

  if (!emp) return <EmptyState title="Not found" />;
  const presentDays = attendance.filter((a) => a.status === 'Present').length;
  const wfhDays = attendance.filter((a) => a.status === 'WFH').length;
  const absentDays = attendance.filter((a) => a.status === 'Absent').length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Row>
          <Avatar name={emp.name} size={64} />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 18 }}>{emp.name}</Text>
            <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>{emp.designation} · {emp.department}</Text>
            <Row style={{ gap: 6, marginTop: 8 }}>
              <Badge label={emp.workMode} color={emp.workMode === 'WFH' ? palette.wfh : emp.workMode === 'WFO' ? palette.primary : palette.accent} />
              <Badge label={emp.shift} />
            </Row>
          </View>
        </Row>
      </Card>

      <SectionHeader title="Snapshot (last 20 days)" />
      <Row style={{ gap: 10 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Present</Text>
          <Text style={{ color: t.colors.success, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{presentDays}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>WFH</Text>
          <Text style={{ color: t.colors.info, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{wfhDays}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Absent</Text>
          <Text style={{ color: t.colors.danger, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{absentDays}</Text>
        </Card>
      </Row>

      <SectionHeader title="Recent attendance" />
      {attendance.slice(0, 6).map((a) => (
        <Card key={a.id} style={{ marginBottom: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: t.colors.text, fontWeight: '600' }}>{a.date}</Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {a.checkIn || '--:--'} – {a.checkOut || '--:--'} · {a.source}
              </Text>
            </View>
            <Badge label={a.status} color={statusColor(a.status, t)} />
          </Row>
        </Card>
      ))}

      <SectionHeader title="Requests" />
      {[...wfh, ...leaves].length === 0 ? (
        <EmptyState title="No recent requests" />
      ) : (
        [...wfh.map((w) => ({ type: 'WFH', id: w.id, label: w.dates.join(', '), status: w.status })), ...leaves.map((l) => ({ type: l.type, id: l.id, label: `${l.from} → ${l.to}`, status: l.status }))]
          .slice(0, 6)
          .map((r) => (
            <Card key={r.id} style={{ marginBottom: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>{r.type}</Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>{r.label}</Text>
                </View>
                <Badge label={r.status} color={statusColor(r.status, t)} />
              </Row>
            </Card>
          ))
      )}

      <View style={{ marginTop: 16 }}>
        <Button
          title="Escalate to HR"
          variant="ghost"
          onPress={() => Alert.alert('Escalated', 'This case has been escalated to HR.')}
        />
      </View>
    </ScrollView>
  );
};

export default TeamMemberDetailScreen;
