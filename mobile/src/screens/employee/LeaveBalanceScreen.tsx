import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, Row, SectionHeader } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';

const LeaveBalanceScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const balances = useAppSelector((s) => s.data.leaveBalances);
  const leaves = useAppSelector((s) => s.data.leaves);
  const user = useAppSelector((s) => s.auth.user)!;
  const myLeaves = leaves.filter((l) => l.userId === user.id);
  const [tab, setTab] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const filtered = tab === 'All' ? myLeaves : myLeaves.filter((l) => l.status === tab);

  // Effective available = approved-adjusted balance minus still-pending days
  const pendingByType = (type: string) =>
    myLeaves.filter((l) => l.type === type && l.status === 'Pending').reduce((s, l) => s + l.days, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Row style={{ gap: 10 }}>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('LeaveApply')}>
          <Card style={{ backgroundColor: t.colors.primary, borderColor: t.colors.primary }}>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginTop: 8 }}>Apply Leave</Text>
          </Card>
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => navigation.navigate('WFHRequest')}>
          <Card style={{ backgroundColor: palette.wfh, borderColor: palette.wfh }}>
            <Ionicons name="home-outline" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginTop: 8 }}>Apply WFH</Text>
          </Card>
        </Pressable>
      </Row>

      <SectionHeader title="Leave balance" />
      <View style={{ gap: 10 }}>
      {balances.map((b) => {
          const pending = pendingByType(b.type);
          const effective = Math.max(0, b.available - pending);
          const pct = b.total > 0 ? ((b.total - effective) / b.total) * 100 : 0;
          return (
            <Card key={b.type}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{b.type} Leave</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: t.colors.text }}>
                    <Text style={{ fontWeight: '800' }}>{effective}</Text>
                    <Text style={{ color: t.colors.textMuted }}> / {b.total} available</Text>
                  </Text>
                  {pending > 0 && (
                    <Text style={{ color: t.colors.warning, fontSize: 11, marginTop: 2 }}>
                      {pending}d pending approval
                    </Text>
                  )}
                </View>
              </Row>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.surfaceAlt, marginTop: 10, overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.colors.primary }} />
              </View>
              <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 6 }}>Used {b.used} days approved</Text>
            </Card>
          );
        })}
      </View>

      <SectionHeader title="My leave history" />
      <Row style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setTab(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: tab === f ? t.colors.primary : t.colors.surface,
              borderWidth: 1,
              borderColor: tab === f ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: tab === f ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 13 }}>{f}</Text>
          </Pressable>
        ))}
      </Row>

      {filtered.length === 0 ? (
        <EmptyState title="No leaves" subtitle="No leaves match this filter." />
      ) : (
        filtered.map((l) => (
          <Card key={l.id} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>
                  {l.type} Leave · {l.days}d
                </Text>
                <Text style={{ color: t.colors.textMuted, marginTop: 4 }}>
                  {l.from} → {l.to}
                </Text>
                <Text style={{ color: t.colors.textMuted, marginTop: 2, fontSize: 12 }}>{l.reason}</Text>
              </View>
              <Badge label={l.status} color={statusColor(l.status, t)} />
            </Row>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

export default LeaveBalanceScreen;
