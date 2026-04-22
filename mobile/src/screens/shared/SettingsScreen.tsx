import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, useColorScheme, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Row, SectionHeader } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleNotificationPref } from '@/store/dataSlice';
import { logout } from '@/store/authSlice';

const SettingsScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const scheme = useColorScheme();
  const dispatch = useAppDispatch();
  const prefs = useAppSelector((s) => s.data.notificationPrefs);
  const [forceDark, setForceDark] = useState(scheme === 'dark');

  const Item: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 12 }}>
      <Text style={{ color: t.colors.text, fontWeight: '600' }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.colors.primary }} />
    </Row>
  );

  const Link: React.FC<{ icon: any; label: string; onPress: () => void }> = ({ icon, label, onPress }) => (
    <Pressable onPress={onPress}>
      <Row style={{ justifyContent: 'space-between', paddingVertical: 14 }}>
        <Row style={{ gap: 10 }}>
          <Ionicons name={icon} size={20} color={t.colors.primary} />
          <Text style={{ color: t.colors.text, fontWeight: '600' }}>{label}</Text>
        </Row>
        <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
      </Row>
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <SectionHeader title="Notifications" />
      <Card>
        <Item label="WFH updates" value={prefs.wfh} onChange={() => dispatch(toggleNotificationPref('wfh'))} />
        <View style={{ height: 1, backgroundColor: t.colors.border }} />
        <Item label="Leave updates" value={prefs.leave} onChange={() => dispatch(toggleNotificationPref('leave'))} />
        <View style={{ height: 1, backgroundColor: t.colors.border }} />
        <Item label="Attendance alerts" value={prefs.attendance} onChange={() => dispatch(toggleNotificationPref('attendance'))} />
        <View style={{ height: 1, backgroundColor: t.colors.border }} />
        <Item label="Correction updates" value={prefs.correction} onChange={() => dispatch(toggleNotificationPref('correction'))} />
        <View style={{ height: 1, backgroundColor: t.colors.border }} />
        <Item label="Company announcements" value={prefs.announcement} onChange={() => dispatch(toggleNotificationPref('announcement'))} />
      </Card>

      <SectionHeader title="Appearance" />
      <Card>
        <Item label="Use dark mode" value={forceDark} onChange={setForceDark} />
        <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>
          Follows system theme automatically.
        </Text>
      </Card>

      <SectionHeader title="Account" />
      <Card>
        <Link icon="lock-closed-outline" label="Change Password" onPress={() => navigation.navigate?.('ChangePassword')} />
        <View style={{ height: 1, backgroundColor: t.colors.border }} />
        <Link icon="help-circle-outline" label="Help & Support" onPress={() => navigation.navigate?.('HelpSupport')} />
      </Card>

      <View style={{ marginTop: 16 }}>
        <Pressable onPress={() => dispatch(logout())} style={{ alignItems: 'center', padding: 14 }}>
          <Text style={{ color: t.colors.danger, fontWeight: '700' }}>Logout</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

export default SettingsScreen;
