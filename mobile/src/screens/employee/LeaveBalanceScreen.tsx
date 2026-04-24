import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, Row, SectionHeader } from '@/components/UI';
import { palette, statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';
import { getLeaveBalance, getLeaveRequests, getEmployees, type LeaveBalanceAPI, type LeaveRequestAPI } from '@/services/api';

const LeaveBalanceScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const employeeDbId = useAppSelector((s) => s.auth.employeeDbId);
  const [empId, setEmpId] = useState<string | null>(employeeDbId);
  const [balances, setBalances] = useState<LeaveBalanceAPI[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequestAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  useEffect(() => {
    if (!empId) {
      getEmployees({ limit: 1 }).then((r) => setEmpId(r.data?.[0]?.id ?? null)).catch(() => {});
    }
  }, [empId]);

  const fetchData = useCallback(async () => {
    if (!empId) return;
    setLoading(true);
    try {
      const [bal, leavs] = await Promise.all([
        getLeaveBalance(empId),
        getLeaveRequests(),
      ]);
      setBalances(bal);
      setLeaves(Array.isArray(leavs) ? leavs : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [empId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = tab === 'All' ? leaves : leaves.filter((l) => l.status === tab);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Row style={{ gap: 10, marginBottom: 8 }}>
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
      {loading ? (
        <ActivityIndicator color={t.colors.primary} style={{ marginVertical: 20 }} />
      ) : balances.length === 0 ? (
        <Card><Text style={{ color: t.colors.textMuted, textAlign: 'center' }}>No leave balances found</Text></Card>
      ) : (
        <View style={{ gap: 10 }}>
          {balances.map((b) => {
            const pct = b.allocated > 0 ? (b.used / b.allocated) * 100 : 0;
            return (
              <Card key={b.leaveTypeId}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>{b.leaveType.name} Leave</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: t.colors.text }}>
                      <Text style={{ fontWeight: '800' }}>{b.remaining}</Text>
                      <Text style={{ color: t.colors.textMuted }}> / {b.allocated} available</Text>
                    </Text>
                  </View>
                </Row>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.border, marginTop: 10, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: t.colors.primary }} />
                </View>
                <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 6 }}>Used: {b.used} days</Text>
              </Card>
            );
          })}
        </View>
      )}

      <SectionHeader title="My leave history" />
      <Row style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((f) => (
          <Pressable
            key={f} onPress={() => setTab(f)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              backgroundColor: tab === f ? t.colors.primary : t.colors.surface,
              borderWidth: 1, borderColor: tab === f ? t.colors.primary : t.colors.border,
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
                  {l.leaveType.name} · {l.totalDays}d
                </Text>
                <Text style={{ color: t.colors.textMuted, marginTop: 4 }}>
                  {l.fromDate.split('T')[0]} → {l.toDate.split('T')[0]}
                </Text>
                <Text style={{ color: t.colors.textMuted, marginTop: 2, fontSize: 12 }}>{l.reason}</Text>
              </View>
              <Badge label={l.status} color={statusColor(l.status as any, t)} />
            </Row>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

export default LeaveBalanceScreen;
