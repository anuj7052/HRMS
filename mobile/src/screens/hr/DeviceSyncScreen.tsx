import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Row, SectionHeader } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { syncAllDevices, syncDevice } from '@/store/dataSlice';

const sinceLabel = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)}h ago`;
};

const DeviceSyncScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.data.devices);
  const [syncingAll, setSyncingAll] = useState(false);

  const totalPunches = devices.reduce((sum, d) => sum + d.punchCountToday, 0);
  const onlineCount = devices.filter((d) => d.status === 'online').length;

  const doSyncAll = () => {
    setSyncingAll(true);
    setTimeout(() => {
      dispatch(syncAllDevices());
      setSyncingAll(false);
      Alert.alert('Sync complete', `${devices.length} devices synced`);
    }, 800);
  };

  const statusColor = (s: string) =>
    s === 'online' ? palette.present : s === 'offline' ? t.colors.textMuted : palette.absent;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Row style={{ gap: 10 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Devices</Text>
          <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{devices.length}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Online</Text>
          <Text style={{ color: t.colors.success, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{onlineCount}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Punches today</Text>
          <Text style={{ color: t.colors.primary, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{totalPunches}</Text>
        </Card>
      </Row>

      <View style={{ marginTop: 14 }}>
        <Button
          title="Sync all devices now"
          onPress={doSyncAll}
          loading={syncingAll}
          icon={<Ionicons name="sync-outline" size={18} color="#fff" />}
        />
        <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
          Auto-sync runs every 15 minutes via background cron.
        </Text>
      </View>

      <SectionHeader title="ESSL biometric devices" />
      {devices.map((d) => (
        <Card key={d.id} style={{ marginBottom: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Row style={{ gap: 8, marginBottom: 6 }}>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{d.name}</Text>
                <Badge label={d.status.toUpperCase()} color={statusColor(d.status)} />
              </Row>
              <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{d.location}</Text>
              <Row style={{ gap: 14, marginTop: 8 }}>
                <Row style={{ gap: 4 }}>
                  <Ionicons name="hardware-chip-outline" size={14} color={t.colors.textMuted} />
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{d.serial}</Text>
                </Row>
                <Row style={{ gap: 4 }}>
                  <Ionicons name="globe-outline" size={14} color={t.colors.textMuted} />
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{d.ip}</Text>
                </Row>
              </Row>
              <Row style={{ gap: 14, marginTop: 6 }}>
                <Row style={{ gap: 4 }}>
                  <Ionicons name="time-outline" size={14} color={t.colors.textMuted} />
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Synced {sinceLabel(d.lastSync)}</Text>
                </Row>
                <Row style={{ gap: 4 }}>
                  <Ionicons name="finger-print-outline" size={14} color={t.colors.textMuted} />
                  <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{d.punchCountToday} punches</Text>
                </Row>
              </Row>
            </View>
            <Pressable
              onPress={() => dispatch(syncDevice(d.id))}
              style={{ padding: 10, borderRadius: 8, backgroundColor: t.colors.primary + '18' }}
            >
              <Ionicons name="refresh" size={20} color={t.colors.primary} />
            </Pressable>
          </Row>
          {d.status === 'error' && (
            <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: t.colors.danger + '15' }}>
              <Text style={{ color: t.colors.danger, fontSize: 12, fontWeight: '600' }}>
                ⚠ Connection error. Punches may need biometric fallback / HR manual entry.
              </Text>
            </View>
          )}
        </Card>
      ))}
    </ScrollView>
  );
};

export default DeviceSyncScreen;
