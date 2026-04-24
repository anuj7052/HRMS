import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Badge, Card, Row, SectionHeader } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { getLiveFeed } from '@/services/api';

interface LiveEntry {
  id: string; empCode: string; name: string; department: string;
  punchIn: string | null; punchOut: string | null;
  workHours: number | null; status: string; source: string;
}

const TeamDashboardScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const [team, setTeam] = useState<LiveEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getLiveFeed()
      .then((res) => setTeam(res.feed))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Present: 0, WFH: 0, Leave: 0, Absent: 0 };
    team.forEach((e) => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [team]);

  const attnPct = team.length > 0
    ? Math.round(((counts.Present + counts.WFH) / team.length) * 100) : 0;

  if (loading) return <ActivityIndicator color={t.colors.primary} style={{ marginTop: 60 }} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Row style={{ gap: 10 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Total</Text>
          <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{team.length}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Present %</Text>
          <Text style={{ color: palette.present, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{attnPct}%</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Absent</Text>
          <Text style={{ color: palette.absent, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{counts.Absent ?? 0}</Text>
        </Card>
      </Row>

      <SectionHeader title="Today's attendance" />
      <Card style={{ marginBottom: 12 }}>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Badge label={`Present: ${counts.Present ?? 0}`} color={palette.present} />
          <Badge label={`WFH: ${counts.WFH ?? 0}`} color={palette.wfh} />
          <Badge label={`Leave: ${counts.Leave ?? 0}`} color={palette.leave} />
          <Badge label={`Absent: ${counts.Absent ?? 0}`} color={palette.absent} />
        </Row>
      </Card>

      <SectionHeader
        title="All employees — today"
        action={
          <Pressable onPress={() => navigation.navigate('Approvals')}>
            <Text style={{ color: t.colors.primary, fontWeight: '600' }}>Approvals →</Text>
          </Pressable>
        }
      />
      <FlatList
        data={team}
        scrollEnabled={false}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                <Avatar name={item.name} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>{item.name}</Text>
                  <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {item.empCode} · {item.department}
                    {item.punchIn ? ` · In: ${new Date(item.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </Text>
                </View>
              </Row>
              <Badge label={item.status} color={statusColor(item.status as any, t)} />
            </Row>
          </Card>
        )}
      />
    </ScrollView>
  );
};

export default TeamDashboardScreen;
