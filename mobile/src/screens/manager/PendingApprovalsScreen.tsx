import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Input, Row } from '@/components/UI';
import { statusColor, useTheme } from '@/theme';
import { useAppSelector } from '@/store';
import { getLeaveRequests, reviewLeave, getMyWFHRequests, type LeaveRequestAPI } from '@/services/api';

const PendingApprovalsScreen: React.FC = () => {
  const t = useTheme();
  const user = useAppSelector((s) => s.auth.user)!;

  const [tab, setTab] = useState<'leave' | 'wfh'>('leave');
  const [leaves, setLeaves] = useState<LeaveRequestAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLeaveRequests('Pending');
      setLeaves(Array.isArray(res) ? res : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'leave') fetchLeaves(); }, [tab, fetchLeaves]);

  const handleReview = async (id: string, status: 'Approved' | 'Rejected') => {
    setProcessing((p) => ({ ...p, [id]: true }));
    try {
      await reviewLeave(id, status, comments[id]);
      setLeaves((prev) => prev.filter((l) => l.id !== id));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update');
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }));
    }
  };

  const TabBtn: React.FC<{ id: 'leave' | 'wfh'; label: string; count: number }> = ({ id, label, count }) => (
    <Pressable
      onPress={() => setTab(id)}
      style={{
        flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
        backgroundColor: tab === id ? t.colors.surface : 'transparent',
        position: 'relative',
      }}
    >
      <Text style={{ color: tab === id ? t.colors.primary : t.colors.textMuted, fontWeight: '600', fontSize: 12, textTransform: 'uppercase' }}>
        {label}
      </Text>
      {count > 0 && (
        <View style={{
          position: 'absolute', top: 4, right: 6,
          backgroundColor: t.colors.danger, borderRadius: 8,
          minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, padding: 16 }}>
      {/* Tab bar */}
      <Row style={{ backgroundColor: t.colors.surfaceAlt, borderRadius: 10, padding: 4, marginBottom: 12 }}>
        <TabBtn id="leave" label="Leaves" count={leaves.filter((l) => l.status === 'Pending').length} />
        <TabBtn id="wfh" label="WFH" count={0} />
      </Row>

      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        {loading ? (
          <ActivityIndicator color={t.colors.primary} style={{ marginTop: 40 }} />
        ) : tab === 'leave' ? (
          leaves.length === 0 ? (
            <EmptyState title="All clear" subtitle="No pending leave requests." />
          ) : (
            leaves.map((l) => (
              <Card key={l.id}>
                <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.colors.text, fontWeight: '700' }}>
                      {l.employee?.user?.name ?? 'Employee'} — {l.leaveType.name}
                    </Text>
                    <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      {l.fromDate.split('T')[0]} → {l.toDate.split('T')[0]} · {l.totalDays}d
                    </Text>
                    <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>{l.reason}</Text>
                  </View>
                  <Badge label={l.status} color={statusColor(l.status as any, t)} />
                </Row>

                <Input
                  value={comments[l.id] ?? ''}
                  onChangeText={(v) => setComments((prev) => ({ ...prev, [l.id]: v }))}
                  placeholder="Comment (optional)"
                  style={{ marginBottom: 10 }}
                />

                <Row style={{ gap: 8 }}>
                  <Button
                    label={processing[l.id] ? '…' : 'Approve'}
                    onPress={() => handleReview(l.id, 'Approved')}
                    disabled={!!processing[l.id]}
                    style={{ flex: 1, backgroundColor: '#16A34A' }}
                    textStyle={{ color: '#fff' }}
                  />
                  <Button
                    label={processing[l.id] ? '…' : 'Reject'}
                    onPress={() => handleReview(l.id, 'Rejected')}
                    disabled={!!processing[l.id]}
                    variant="outline"
                    style={{ flex: 1, borderColor: t.colors.danger }}
                    textStyle={{ color: t.colors.danger }}
                  />
                </Row>
              </Card>
            ))
          )
        ) : (
          <EmptyState title="WFH requests" subtitle="WFH approval coming soon." />
        )}
      </ScrollView>
    </View>
  );
};

export default PendingApprovalsScreen;
