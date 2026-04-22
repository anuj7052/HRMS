import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/authSlice';
import { Avatar } from '@/components/UI';
import { palette, useTheme } from '@/theme';

interface ItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  color: string;
  badge?: number;
  onPress: () => void;
}

const MoreItem: React.FC<ItemProps> = ({ icon, label, sub, color, badge, onPress }) => {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14,
        padding: 14,
        backgroundColor: t.colors.surface,
        borderRadius: 14, marginBottom: 8,
        borderWidth: 1, borderColor: t.colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 42, height: 42, borderRadius: 12,
          backgroundColor: color + '1A',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.colors.text, fontWeight: '600', fontSize: 15 }}>{label}</Text>
        {!!sub && <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 1 }}>{sub}</Text>}
      </View>
      {badge != null && badge > 0 && (
        <View
          style={{
            backgroundColor: palette.absent, borderRadius: 9,
            minWidth: 20, height: 20, alignItems: 'center',
            justifyContent: 'center', paddingHorizontal: 5, marginRight: 6,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={15} color={t.colors.textMuted} />
    </Pressable>
  );
};

const GroupLabel: React.FC<{ title: string }> = ({ title }) => {
  const t = useTheme();
  return (
    <Text
      style={{
        color: t.colors.textMuted, fontSize: 11, fontWeight: '700',
        letterSpacing: 0.8, textTransform: 'uppercase',
        marginBottom: 8, marginTop: 16,
      }}
    >
      {title}
    </Text>
  );
};

const HRMoreScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const notifications = useAppSelector((s) => s.data.notifications);
  const leaves = useAppSelector((s) => s.data.leaves);
  const wfhRequests = useAppSelector((s) => s.data.wfhRequests);
  const corrections = useAppSelector((s) => s.data.corrections);

  const unread = notifications.filter((n) => !n.read).length;
  const pendingLeaves = leaves.filter((l) => l.status === 'Pending').length;
  const pendingWFH = wfhRequests.filter((w) => w.status === 'Pending').length;
  const pendingCorrections = corrections.filter((c) => c.status === 'Pending').length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 14,
          backgroundColor: t.colors.surface,
          borderRadius: 18, padding: 16, marginBottom: 4,
          borderWidth: 1, borderColor: t.colors.border,
        }}
      >
        <Avatar name={user.name} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 17 }}>{user.name}</Text>
          <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>{user.designation}</Text>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{user.email}</Text>
        </View>
      </View>

      {/* Data & Sync */}
      <GroupLabel title="Data & Sync" />
      <MoreItem icon="pulse-outline" label="eSSL Live Sync" sub="Fetch biometric punches"
        color="#8B5CF6" onPress={() => navigation.navigate('EsslConnection')} />
      <MoreItem icon="bar-chart-outline" label="Attendance Reports" sub="Export & analyse"
        color={palette.accent} onPress={() => navigation.navigate('Reports')} />
      <MoreItem icon="finger-print-outline" label="Biometric Devices" sub="ESSL device management"
        color="#0EA5E9" onPress={() => navigation.navigate('Devices')} />

      {/* Configuration */}
      <GroupLabel title="Configuration" />
      <MoreItem icon="time-outline" label="Shift Management" sub="Define work shifts"
        color="#EC4899" onPress={() => navigation.navigate('ShiftMgmt')} />
      <MoreItem icon="document-text-outline" label="Policy Settings" sub="Attendance rules"
        color="#6B7280" onPress={() => navigation.navigate('Policies')} />
      <MoreItem icon="flag-outline" label="Holiday Master" sub="Manage holiday calendar"
        color="#14B8A6" onPress={() => navigation.navigate('Holidays')} />
      <MoreItem icon="megaphone-outline" label="Announcements" sub="Post company updates"
        color="#F97316" onPress={() => navigation.navigate('Announcements')} />

      {/* Pending */}
      <GroupLabel title="Pending Actions" />
      <MoreItem icon="document-outline" label="Leave Requests"
        sub={`${pendingLeaves} pending`} color={palette.leave}
        badge={pendingLeaves} onPress={() => navigation.navigate('ApprovalsScreen')} />
      <MoreItem icon="home-outline" label="WFH Requests"
        sub={`${pendingWFH} pending`} color={palette.wfh}
        badge={pendingWFH} onPress={() => navigation.navigate('ApprovalsScreen')} />
      <MoreItem icon="create-outline" label="Corrections"
        sub={`${pendingCorrections} pending`} color={palette.present}
        badge={pendingCorrections} onPress={() => navigation.navigate('ApprovalsScreen')} />

      {/* Account */}
      <GroupLabel title="Account" />
      <MoreItem icon="notifications-outline" label="Notifications"
        sub={unread > 0 ? `${unread} unread` : 'No new notifications'}
        color={palette.primary} badge={unread}
        onPress={() => navigation.navigate('Notifications')} />
      <MoreItem icon="settings-outline" label="Settings" sub="App preferences"
        color="#64748B" onPress={() => navigation.navigate('SettingsMore')} />
      <MoreItem icon="key-outline" label="Change Password"
        color={palette.absent} onPress={() => navigation.navigate('ChangePassword')} />
      <MoreItem icon="help-circle-outline" label="Help & Support"
        color={palette.wfh} onPress={() => navigation.navigate('HelpSupport')} />

      {/* Logout */}
      <Pressable
        onPress={() => dispatch(logout())}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 14,
          padding: 14, borderRadius: 14, marginTop: 8,
          backgroundColor: palette.absent + '10',
          borderWidth: 1, borderColor: palette.absent + '30',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View
          style={{
            width: 42, height: 42, borderRadius: 12,
            backgroundColor: palette.absent + '1A',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={palette.absent} />
        </View>
        <Text style={{ color: palette.absent, fontWeight: '700', fontSize: 15, flex: 1 }}>Logout</Text>
      </Pressable>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

export default HRMoreScreen;
