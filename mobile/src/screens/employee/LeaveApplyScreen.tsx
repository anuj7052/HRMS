import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Row, SectionHeader } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { addLeave } from '@/store/dataSlice';
import { LeaveType } from '@/types';

const LEAVE_TYPES: LeaveType[] = ['Sick', 'Casual', 'Paid', 'CompOff', 'Optional'];

const toISO = (d: Date) => d.toISOString().split('T')[0];

const LeaveApplyScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const balances = useAppSelector((s) => s.data.leaveBalances);
  const myLeaves = useAppSelector((s) => s.data.leaves.filter((l) => l.userId === user.id));

  const [type, setType] = useState<LeaveType>('Casual');
  const [fromIdx, setFromIdx] = useState(1);
  const [toIdx, setToIdx] = useState(1);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const diffDays =
    Math.max(0, Math.ceil((days[toIdx].getTime() - days[fromIdx].getTime()) / 86400000)) + 1;

  // Effective available = bal.available (approved-adjusted) minus any still-Pending requests
  const effectiveAvailable = useMemo(() => {
    const bal = balances.find((b) => b.type === type);
    if (!bal) return 0;
    const pendingDays = myLeaves
      .filter((l) => l.type === type && l.status === 'Pending')
      .reduce((sum, l) => sum + l.days, 0);
    return Math.max(0, bal.available - pendingDays);
  }, [balances, myLeaves, type]);

  const submit = () => {
    const e: Record<string, string> = {};
    if (toIdx < fromIdx) e.date = 'End date must be after start date';
    if (!reason.trim()) e.reason = 'Reason required';
    if (diffDays > effectiveAvailable)
      e.reason = `Only ${effectiveAvailable} ${type} days available (incl. pending)`;
    setErrors(e);
    if (Object.keys(e).length) return;
    dispatch(
      addLeave({
        id: 'l-' + Date.now(),
        userId: user.id,
        userName: user.name,
        type,
        from: toISO(days[fromIdx]),
        to: toISO(days[toIdx]),
        days: diffDays,
        reason: reason.trim(),
        status: 'Pending',
        createdAt: new Date().toISOString(),
      })
    );
    Alert.alert('Applied', `${type} leave submitted for ${diffDays} day(s). Awaiting approval.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Leave type</Text>
        <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {LEAVE_TYPES.map((lt) => (
            <Pressable
              key={lt}
              onPress={() => setType(lt)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: type === lt ? t.colors.primary : t.colors.surfaceAlt,
              }}
            >
              <Text style={{ color: type === lt ? '#fff' : t.colors.text, fontWeight: '600' }}>{lt}</Text>
            </Pressable>
          ))}
        </Row>
        <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 10 }}>
          Available: {effectiveAvailable} days
          {effectiveAvailable < (balances.find((b) => b.type === type)?.available ?? 0)
            ? ` (${(balances.find((b) => b.type === type)?.available ?? 0) - effectiveAvailable} pending)`
            : ''}
        </Text>
      </Card>

      <SectionHeader title="From" />
      <DatePicker days={days} index={fromIdx} onChange={setFromIdx} />

      <SectionHeader title="To" />
      <DatePicker days={days} index={toIdx} onChange={setToIdx} />

      {errors.date && <Text style={{ color: t.colors.danger, marginTop: 6 }}>{errors.date}</Text>}

      <Card style={{ marginTop: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: t.colors.textMuted }}>Total days</Text>
          <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 16 }}>{diffDays}</Text>
        </Row>
      </Card>

      <View style={{ marginTop: 16 }}>
        <Input label="Reason" value={reason} onChangeText={setReason} placeholder="Reason for leave" multiline error={errors.reason} />
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
          <Ionicons name="attach" size={18} color={t.colors.primary} />
          <Text style={{ color: t.colors.primary, fontWeight: '600' }}>Attach supporting document (optional)</Text>
        </Pressable>
        <Button title="Apply Leave" onPress={submit} />
      </View>
    </ScrollView>
  );
};

const DatePicker: React.FC<{ days: Date[]; index: number; onChange: (i: number) => void }> = ({ days, index, onChange }) => {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {days.map((d, i) => {
        const active = i === index;
        return (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
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
  );
};

export default LeaveApplyScreen;
