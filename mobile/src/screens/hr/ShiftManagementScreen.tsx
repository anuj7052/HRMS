import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Input, Row, SectionHeader } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { removeShift, upsertShift } from '@/store/dataSlice';
import { Shift, ShiftType } from '@/types';

const TYPES: ShiftType[] = ['Morning', 'Evening', 'Night', 'Flexible'];

const typeColor = (t: ShiftType) =>
  t === 'Morning' ? palette.present : t === 'Evening' ? palette.accent : t === 'Night' ? palette.primary : palette.wfh;

const empty = (): Shift => ({
  id: 's-' + Date.now(),
  name: '',
  type: 'Morning',
  startTime: '09:30',
  endTime: '18:30',
  graceMinutes: 15,
  assignedCount: 0,
});

const ShiftManagementScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const shifts = useAppSelector((s) => s.data.shifts);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    if (!editing) return;
    const e: Record<string, string> = {};
    if (!editing.name.trim()) e.name = 'Required';
    if (!/^\d{2}:\d{2}$/.test(editing.startTime)) e.startTime = 'HH:mm';
    if (!/^\d{2}:\d{2}$/.test(editing.endTime)) e.endTime = 'HH:mm';
    setErrors(e);
    if (Object.keys(e).length) return;
    dispatch(upsertShift(editing));
    Alert.alert('Saved', 'Shift updated.');
    setEditing(null);
  };

  const remove = (s: Shift) =>
    Alert.alert('Delete shift?', s.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => dispatch(removeShift(s.id)) },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <SectionHeader
        title="Shifts"
        action={
          <Pressable onPress={() => setEditing(empty())}>
            <Text style={{ color: t.colors.primary, fontWeight: '700' }}>+ New shift</Text>
          </Pressable>
        }
      />

      {shifts.length === 0 ? (
        <EmptyState title="No shifts" subtitle="Create a shift to assign to employees." />
      ) : (
        shifts.map((s) => (
          <Card key={s.id} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Row style={{ gap: 8, marginBottom: 6 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15 }}>{s.name}</Text>
                  <Badge label={s.type} color={typeColor(s.type)} />
                </Row>
                <Row style={{ gap: 14 }}>
                  <Row style={{ gap: 4 }}>
                    <Ionicons name="time-outline" size={14} color={t.colors.textMuted} />
                    <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
                      {s.startTime} – {s.endTime}
                    </Text>
                  </Row>
                  <Row style={{ gap: 4 }}>
                    <Ionicons name="hourglass-outline" size={14} color={t.colors.textMuted} />
                    <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{s.graceMinutes}m grace</Text>
                  </Row>
                  <Row style={{ gap: 4 }}>
                    <Ionicons name="people-outline" size={14} color={t.colors.textMuted} />
                    <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{s.assignedCount} assigned</Text>
                  </Row>
                </Row>
              </View>
              <Row style={{ gap: 12 }}>
                <Pressable onPress={() => setEditing({ ...s })}>
                  <Ionicons name="create-outline" size={22} color={t.colors.primary} />
                </Pressable>
                <Pressable onPress={() => remove(s)}>
                  <Ionicons name="trash-outline" size={22} color={t.colors.danger} />
                </Pressable>
              </Row>
            </Row>
          </Card>
        ))
      )}

      {editing && (
        <Card style={{ marginTop: 14 }}>
          <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 10 }}>
            {shifts.find((s) => s.id === editing.id) ? 'Edit shift' : 'New shift'}
          </Text>
          <Input label="Name" value={editing.name} onChangeText={(v) => setEditing({ ...editing, name: v })} error={errors.name} />
          <Text style={{ color: t.colors.textMuted, fontSize: 12, marginBottom: 6 }}>Type</Text>
          <Row style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {TYPES.map((tp) => (
              <Pressable
                key={tp}
                onPress={() => setEditing({ ...editing, type: tp })}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: editing.type === tp ? t.colors.primary : t.colors.surfaceAlt,
                }}
              >
                <Text style={{ color: editing.type === tp ? '#fff' : t.colors.text, fontWeight: '600' }}>{tp}</Text>
              </Pressable>
            ))}
          </Row>
          <Row style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input label="Start (HH:mm)" value={editing.startTime} onChangeText={(v) => setEditing({ ...editing, startTime: v })} error={errors.startTime} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="End (HH:mm)" value={editing.endTime} onChangeText={(v) => setEditing({ ...editing, endTime: v })} error={errors.endTime} />
            </View>
          </Row>
          <Input
            label="Grace period (mins)"
            value={String(editing.graceMinutes)}
            onChangeText={(v) => setEditing({ ...editing, graceMinutes: parseInt(v || '0', 10) })}
            keyboardType="number-pad"
          />
          <Row style={{ gap: 10 }}>
            <Button title="Save" onPress={save} style={{ flex: 1 }} />
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
          </Row>
        </Card>
      )}
    </ScrollView>
  );
};

export default ShiftManagementScreen;
