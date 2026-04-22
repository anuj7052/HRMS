import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Input, Row, SectionHeader } from '@/components/UI';
import { statusColor, useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { addWFHRequest } from '@/store/dataSlice';

const toISO = (d: Date) => d.toISOString().split('T')[0];

const WFHRequestScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const requests = useAppSelector((s) => s.data.wfhRequests.filter((r) => r.userId === user.id));
  const policies = useAppSelector((s) => s.data.policies);

  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const policy = policies.find((p) => p.scope === 'department' && p.target === user.department) ?? policies[0];
  const thisMonthUsed = useMemo(() => {
    const m = new Date().getMonth();
    const y = new Date().getFullYear();
    return requests
      .filter((r) => r.status !== 'Rejected')
      .flatMap((r) => r.dates)
      .filter((d) => {
        const dt = new Date(d);
        return dt.getMonth() === m && dt.getFullYear() === y;
      }).length;
  }, [requests]);

  const remaining = Math.max(0, (policy?.maxWfhPerMonth ?? 8) - thisMonthUsed);

  if (user.workMode === 'WFO') {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, padding: 16 }}>
        <EmptyState
          title="WFH not available"
          subtitle="Your work mode is Work-From-Office. Attendance is via ESSL device only."
        />
      </View>
    );
  }

  const next7 = Array.from({ length: 10 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });

  const toggleDate = (iso: string) => {
    setSelected((s) => (s.includes(iso) ? s.filter((x) => x !== iso) : [...s, iso]));
  };

  const submit = () => {
    if (selected.length === 0) return setError('Pick at least one date');
    if (!reason.trim()) return setError('Please provide a reason');
    if (selected.length > remaining) return setError(`Only ${remaining} WFH days remaining this month`);
    setError('');
    dispatch(
      addWFHRequest({
        id: 'w-' + Date.now(),
        userId: user.id,
        userName: user.name,
        dates: selected,
        reason: reason.trim(),
        status: 'Pending',
        createdAt: new Date().toISOString(),
      })
    );
    setSelected([]);
    setReason('');
    Alert.alert('Submitted', 'Your WFH request has been sent for approval.');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>WFH days this month</Text>
            <Text style={{ color: t.colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 }}>
              {thisMonthUsed} / {policy?.maxWfhPerMonth ?? 8}
            </Text>
          </View>
          <Badge label={`${remaining} left`} color={remaining > 0 ? t.colors.success : t.colors.danger} />
        </Row>
      </Card>

      <SectionHeader title="Select date(s)" />
      <FlatList
        data={next7}
        horizontal
        keyExtractor={(d) => toISO(d)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => {
          const iso = toISO(item);
          const active = selected.includes(iso);
          return (
            <Pressable
              onPress={() => toggleDate(iso)}
              style={{
                width: 64,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: active ? t.colors.primary : t.colors.surface,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: active ? t.colors.primary : t.colors.border,
              }}
            >
              <Text style={{ color: active ? '#fff' : t.colors.textMuted, fontSize: 11 }}>
                {item.toLocaleDateString('en', { weekday: 'short' })}
              </Text>
              <Text style={{ color: active ? '#fff' : t.colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 }}>
                {item.getDate()}
              </Text>
              <Text style={{ color: active ? '#fff' : t.colors.textMuted, fontSize: 11, marginTop: 2 }}>
                {item.toLocaleDateString('en', { month: 'short' })}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={{ marginTop: 16 }}>
        <Input label="Reason" value={reason} onChangeText={setReason} placeholder="Why WFH?" multiline error={error} />
        <Button title="Submit request" onPress={submit} icon={<Ionicons name="send" size={16} color="#fff" />} />
      </View>

      <SectionHeader title="My requests" />
      {requests.length === 0 ? (
        <EmptyState title="No WFH requests yet" />
      ) : (
        requests.map((r) => (
          <Card key={r.id} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{r.dates.join(', ')}</Text>
                <Text style={{ color: t.colors.textMuted, marginTop: 4 }}>{r.reason}</Text>
                {r.managerComment && (
                  <Text style={{ color: t.colors.textMuted, marginTop: 6, fontSize: 12, fontStyle: 'italic' }}>
                    Mgr: {r.managerComment}
                  </Text>
                )}
              </View>
              <Badge label={r.status} color={statusColor(r.status, t)} />
            </Row>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

export default WFHRequestScreen;
