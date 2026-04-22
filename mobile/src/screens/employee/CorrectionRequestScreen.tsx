import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Input, Row, SectionHeader } from '@/components/UI';
import { statusColor, useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { addCorrection } from '@/store/dataSlice';

const REASONS = ['Forgot to punch', 'Device offline', 'Approved meeting outside', 'Other'];

const CorrectionRequestScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const corrections = useAppSelector((s) => s.data.corrections.filter((c) => c.userId === user.id));

  const [dateIdx, setDateIdx] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState('');
  const [err, setErr] = useState('');

  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  });

  const submit = () => {
    if (!detail.trim()) return setErr('Please describe the issue');
    setErr('');
    dispatch(
      addCorrection({
        id: 'c-' + Date.now(),
        userId: user.id,
        date: days[dateIdx].toISOString().split('T')[0],
        reason,
        detail: detail.trim(),
        status: 'Pending',
        createdAt: new Date().toISOString(),
      })
    );
    setDetail('');
    Alert.alert('Submitted', 'Correction request sent to HR.');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: t.colors.textMuted, marginBottom: 10 }}>Select date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d, i) => {
          const active = dateIdx === i;
          return (
            <Pressable
              key={i}
              onPress={() => setDateIdx(i)}
              style={{
                width: 60,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: active ? t.colors.primary : t.colors.surface,
                borderWidth: 1,
                borderColor: active ? t.colors.primary : t.colors.border,
              }}
            >
              <Text style={{ color: active ? '#fff' : t.colors.textMuted, fontSize: 11 }}>{d.toLocaleDateString('en', { weekday: 'short' })}</Text>
              <Text style={{ color: active ? '#fff' : t.colors.text, fontSize: 17, fontWeight: '800', marginTop: 3 }}>{d.getDate()}</Text>
              <Text style={{ color: active ? '#fff' : t.colors.textMuted, fontSize: 11 }}>{d.toLocaleDateString('en', { month: 'short' })}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionHeader title="Reason" />
      <Row style={{ flexWrap: 'wrap', gap: 8 }}>
        {REASONS.map((r) => (
          <Pressable
            key={r}
            onPress={() => setReason(r)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: reason === r ? t.colors.primary : t.colors.surfaceAlt,
            }}
          >
            <Text style={{ color: reason === r ? '#fff' : t.colors.text, fontWeight: '600' }}>{r}</Text>
          </Pressable>
        ))}
      </Row>

      <View style={{ marginTop: 16 }}>
        <Input label="Details" value={detail} onChangeText={setDetail} multiline placeholder="Explain briefly…" error={err} />
        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            padding: 12,
            backgroundColor: t.colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: t.colors.border,
            borderStyle: 'dashed',
            marginBottom: 12,
          }}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={t.colors.primary} />
          <Text style={{ color: t.colors.primary, fontWeight: '600' }}>Upload document (optional)</Text>
        </Pressable>
        <Button title="Submit Request" onPress={submit} />
      </View>

      <SectionHeader title="My correction requests" />
      {corrections.length === 0 ? (
        <EmptyState title="No corrections yet" />
      ) : (
        corrections.map((c) => (
          <Card key={c.id} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{c.date} · {c.reason}</Text>
                <Text style={{ color: t.colors.textMuted, marginTop: 4 }}>{c.detail}</Text>
              </View>
              <Badge label={c.status} color={statusColor(c.status, t)} />
            </Row>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

export default CorrectionRequestScreen;
