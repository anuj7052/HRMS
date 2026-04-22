import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Badge, Button, Card, Input, Row, SectionHeader } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { setAppCheckInEnabled, upsertPolicy } from '@/store/dataSlice';
import { Policy } from '@/types';

const PolicySettingsScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const policies = useAppSelector((s) => s.data.policies);
  const appCheckInEnabled = useAppSelector((s) => s.data.appCheckInEnabled);
  const [editing, setEditing] = useState<Policy | null>(null);

  const startEdit = (p: Policy) => setEditing({ ...p });

  const save = () => {
    if (!editing) return;
    dispatch(upsertPolicy(editing));
    Alert.alert('Saved', 'Policy updated.');
    setEditing(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>

      {/* ── App Check-In Toggle ───────────────────────────────────────── */}
      <SectionHeader title="App Attendance" />
      <Card style={{ marginBottom: 20 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15 }}>
              Allow App Check-In / Check-Out
            </Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>
              When enabled, all employees will see the Check-In / Check-Out timer button on their dashboard. Disable to restrict attendance marking to biometric devices only.
            </Text>
          </View>
          <Switch
            value={appCheckInEnabled}
            onValueChange={(val) => { dispatch(setAppCheckInEnabled(val)); }}
            trackColor={{ false: t.colors.border, true: t.colors.success }}
            thumbColor="#fff"
          />
        </Row>
        <View style={{
          marginTop: 12, paddingVertical: 8, paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: appCheckInEnabled ? (t.colors.success + '18') : (t.colors.danger + '18'),
        }}>
          <Text style={{
            color: appCheckInEnabled ? t.colors.success : t.colors.danger,
            fontWeight: '700', fontSize: 13, textAlign: 'center',
          }}>
            {appCheckInEnabled
              ? '✓ Check-In button is visible to all employees'
              : '✕ Check-In button is hidden — biometric only'}
          </Text>
        </View>
      </Card>

      {/* ── Policies ──────────────────────────────────────────────────── */}
      <SectionHeader title="Policies" action={<Pressable onPress={() => setEditing({ id: 'p-' + Date.now(), scope: 'department', target: '', maxWfhPerMonth: 8, gracePeriodMins: 15, shiftStart: '09:30', shiftEnd: '18:30' })}><Text style={{ color: t.colors.primary, fontWeight: '700' }}>+ New</Text></Pressable>} />

      {policies.map((p) => (
        <Card key={p.id} style={{ marginBottom: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Row style={{ gap: 6, marginBottom: 6 }}>
                <Badge label={p.scope.toUpperCase()} />
                {p.target && <Badge label={p.target} color={t.colors.info} />}
              </Row>
              <Text style={{ color: t.colors.text, marginTop: 4 }}>Max WFH/month: {p.maxWfhPerMonth}</Text>
              <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                Grace {p.gracePeriodMins} min · Shift {p.shiftStart} – {p.shiftEnd}
              </Text>
            </View>
            <Pressable onPress={() => startEdit(p)}>
              <Text style={{ color: t.colors.primary, fontWeight: '700' }}>Edit</Text>
            </Pressable>
          </Row>
        </Card>
      ))}

      {editing && (
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 10 }}>Edit policy</Text>
          <Row style={{ gap: 8, marginBottom: 12 }}>
            {(['global', 'department', 'employee'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setEditing({ ...editing, scope: s })}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: editing.scope === s ? t.colors.primary : t.colors.surfaceAlt,
                }}
              >
                <Text style={{ color: editing.scope === s ? '#fff' : t.colors.text, fontWeight: '600', textTransform: 'capitalize' }}>{s}</Text>
              </Pressable>
            ))}
          </Row>
          {editing.scope !== 'global' && (
            <Input
              label={editing.scope === 'department' ? 'Department' : 'Employee code'}
              value={editing.target ?? ''}
              onChangeText={(v) => setEditing({ ...editing, target: v })}
            />
          )}
          <Input
            label="Max WFH days per month"
            value={String(editing.maxWfhPerMonth)}
            onChangeText={(v) => setEditing({ ...editing, maxWfhPerMonth: parseInt(v || '0', 10) })}
            keyboardType="number-pad"
          />
          <Input
            label="Grace period (minutes)"
            value={String(editing.gracePeriodMins)}
            onChangeText={(v) => setEditing({ ...editing, gracePeriodMins: parseInt(v || '0', 10) })}
            keyboardType="number-pad"
          />
          <Input label="Shift start (HH:mm)" value={editing.shiftStart} onChangeText={(v) => setEditing({ ...editing, shiftStart: v })} />
          <Input label="Shift end (HH:mm)" value={editing.shiftEnd} onChangeText={(v) => setEditing({ ...editing, shiftEnd: v })} />
          <Row style={{ gap: 10 }}>
            <Button title="Save" onPress={save} style={{ flex: 1 }} />
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
          </Row>
        </Card>
      )}
    </ScrollView>
  );
};

export default PolicySettingsScreen;
