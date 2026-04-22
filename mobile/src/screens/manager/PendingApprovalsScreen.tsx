import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Input, Row } from '@/components/UI';
import { statusColor, useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { updateLeaveStatus, updateWFHStatus, updateCorrectionStatus } from '@/store/dataSlice';

const PendingApprovalsScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  // HR, CEO (designation), Director all get full visibility
  const isFullAdmin = user.role === 'hr';
  const employees = useAppSelector((s) => s.data.employees);
  const visibleEmpIds = isFullAdmin
    ? employees.map((e) => e.id)
    : employees.filter((e) => e.managerId === user.id).map((e) => e.id);

  const wfh = useAppSelector((s) => s.data.wfhRequests.filter((w) => visibleEmpIds.includes(w.userId)));
  const leaves = useAppSelector((s) => s.data.leaves.filter((l) => visibleEmpIds.includes(l.userId)));
  const corrections = useAppSelector((s) => s.data.corrections.filter((c) => visibleEmpIds.includes(c.userId)));

  const [tab, setTab] = useState<'wfh' | 'leave' | 'correction'>('leave');
  const [comments, setComments] = useState<Record<string, string>>({});

  const pendingWFH = wfh.filter((w) => w.status === 'Pending').length;
  const pendingLeaves = leaves.filter((l) => l.status === 'Pending').length;
  const pendingCorrections = corrections.filter((c) => c.status === 'Pending').length;

  const data = tab === 'wfh' ? wfh : tab === 'leave' ? leaves : corrections;

  const TabBtn: React.FC<{ id: 'wfh' | 'leave' | 'correction'; label: string; count: number }> = ({ id, label, count }) => (
    <Pressable
      onPress={() => setTab(id)}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
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
      {/* Role label */}
      <Row style={{ marginBottom: 10, gap: 6 }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
          {isFullAdmin ? `Showing all employees (${user.designation || user.role})` : `Showing your team only`}
        </Text>
      </Row>

      {/* Tab bar */}
      <Row style={{ backgroundColor: t.colors.surfaceAlt, borderRadius: 10, padding: 4, marginBottom: 12 }}>
        <TabBtn id="leave" label="Leaves" count={pendingLeaves} />
        <TabBtn id="wfh" label="WFH" count={pendingWFH} />
        <TabBtn id="correction" label="Correction" count={pendingCorrections} />
      </Row>

      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        {data.length === 0 ? (
          <EmptyState title="All clear" subtitle="No requests for this category." />
        ) : (
          data.map((item: any) => (
            <Card key={item.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '700' }}>
                    {item.userName || employees.find((e) => e.id === item.userId)?.name || item.userId}
                  </Text>
                  <Text style={{ color: t.colors.textMuted, marginTop: 4, fontSize: 13 }}>
                    {tab === 'wfh'
                      ? item.dates.join(', ')
                      : tab === 'leave'
                      ? `${item.from} → ${item.to} (${item.days}d · ${item.type})`
                      : `${item.date} · ${item.reason}`}
                  </Text>
                  <Text style={{ color: t.colors.textMuted, marginTop: 4, fontSize: 12, fontStyle: 'italic' }}>
                    {tab === 'correction' ? item.detail : item.reason}
                  </Text>
                </View>
                <Badge label={item.status} color={statusColor(item.status, t)} />
              </Row>

              {item.status === 'Pending' && (
                <View style={{ marginTop: 10 }}>
                  <Input
                    value={comments[item.id] ?? ''}
                    onChangeText={(v) => setComments({ ...comments, [item.id]: v })}
                    placeholder="Comment (optional)"
                  />
                  <Row style={{ gap: 10 }}>
                    <Button
                      title="Approve"
                      onPress={() => {
                        if (tab === 'wfh') {
                          dispatch(updateWFHStatus({ id: item.id, status: 'Approved', comment: comments[item.id], hrOverride: isFullAdmin }));
                        } else if (tab === 'leave') {
                          dispatch(updateLeaveStatus({ id: item.id, status: 'Approved', comment: comments[item.id] }));
                        } else {
                          dispatch(updateCorrectionStatus({ id: item.id, status: 'Approved' }));
                        }
                        Alert.alert('Approved', 'Decision saved.');
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Reject"
                      variant="danger"
                      onPress={() => {
                        if (tab === 'wfh') {
                          dispatch(updateWFHStatus({ id: item.id, status: 'Rejected', comment: comments[item.id], hrOverride: isFullAdmin }));
                        } else if (tab === 'leave') {
                          dispatch(updateLeaveStatus({ id: item.id, status: 'Rejected', comment: comments[item.id] }));
                        } else {
                          dispatch(updateCorrectionStatus({ id: item.id, status: 'Rejected' }));
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                  </Row>
                </View>
              )}

              {item.status !== 'Pending' && (item.managerComment || item.approverComment) && (
                <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>
                  Note: {item.managerComment || item.approverComment}
                </Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default PendingApprovalsScreen;
