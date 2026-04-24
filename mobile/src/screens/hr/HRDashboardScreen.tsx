import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Row } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { useAppSelector } from '@/store';
import { getLiveFeed, getLeaveRequests } from '@/services/api';

// ─── Tile component ───────────────────────────────────────────────────────────
interface TileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  color: string;
  badge?: number;
  onPress: () => void;
}

const Tile: React.FC<TileProps> = ({ icon, label, sub, color, badge, onPress }) => {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: '46%',
        backgroundColor: t.colors.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: t.colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: t.mode === 'dark' ? 0.25 : 0.06,
        shadowRadius: 6,
        elevation: 2,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 48, height: 48, borderRadius: 14,
          backgroundColor: color + '1A',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <Ionicons name={icon} size={23} color={color} />
        {badge != null && badge > 0 && (
          <View
            style={{
              position: 'absolute', top: -5, right: -5,
              backgroundColor: palette.absent,
              borderRadius: 9, minWidth: 18, height: 18,
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
      <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 13, lineHeight: 17 }}>{label}</Text>
      {!!sub && <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 3 }}>{sub}</Text>}
    </Pressable>
  );
};

// ─── Section label ────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ title: string }> = ({ title }) => {
  const t = useTheme();
  return (
    <Text
      style={{
        color: t.colors.textMuted, fontSize: 11, fontWeight: '700',
        letterSpacing: 0.8, textTransform: 'uppercase',
        marginBottom: 10, marginTop: 4,
      }}
    >
      {title}
    </Text>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
const HRDashboardScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const user = useAppSelector((s) => s.auth.user)!;
  const notifications = useAppSelector((s) => s.data.notifications);

  const [stats, setStats] = useState({ active: 0, present: 0, absent: 0, late: 0 });
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const unread = notifications.filter((n) => !n.read).length;
  const totalPending = pendingLeaves;

  useEffect(() => {
    // Load live attendance stats
    getLiveFeed().then((res) => {
      const present = res.feed.filter((f) => f.status === 'Present' || f.status === 'WFH').length;
      const absent = res.feed.filter((f) => f.status === 'Absent').length;
      const total = res.total;
      setStats({ active: total, present, absent, late: 0 });
    }).catch(() => {});

    // Load pending leaves count
    getLeaveRequests('Pending').then((leaves) => {
      setPendingLeaves(Array.isArray(leaves) ? leaves.length : 0);
    }).catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateFmt = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ═══ Hero header ══════════════════════════════════════════════════ */}
      <View
        style={{
          backgroundColor: palette.primary,
          paddingTop: Platform.OS === 'ios' ? 60 : 44,
          paddingHorizontal: 20,
          paddingBottom: 24,
        }}
      >
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View style={{ flex: 1, paddingRight: 14 }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 3 }}>
              {greet} 👋
            </Text>
            <Text style={{ color: '#fff', fontSize: 21, fontWeight: '800', lineHeight: 26 }}>
              {user.name}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
              {dateFmt}
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            style={{ padding: 6, position: 'relative' }}
          >
            <Ionicons name="notifications-outline" size={26} color="#fff" />
            {unread > 0 && (
              <View
                style={{
                  position: 'absolute', top: 2, right: 2,
                  width: 16, height: 16, borderRadius: 8,
                  backgroundColor: palette.absent,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </Pressable>
        </Row>

        {/* Today metrics bar */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'rgba(255,255,255,0.13)',
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 6,
          }}
        >
          {[
            { label: 'Total', value: stats.active, color: '#fff' },
            { label: 'Present', value: stats.present, color: '#4ADE80' },
            { label: 'Absent', value: stats.absent, color: '#FCA5A5' },
            { label: 'Late', value: stats.late, color: '#FCD34D' },
          ].map((s, i) => (
            <View
              key={s.label}
              style={{
                flex: 1, alignItems: 'center',
                borderRightWidth: i < 3 ? 1 : 0,
                borderRightColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Text style={{ color: s.color, fontSize: 28, fontWeight: '900', lineHeight: 32 }}>
                {s.value}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 4 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ═══ Tiles ════════════════════════════════════════════════════════ */}
      <View style={{ padding: 16 }}>

        {/* People & Attendance */}
        <SectionLabel title="People & Attendance" />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <Tile
            icon="people-outline" label="Employees"
            sub={`${stats.active} active`} color={palette.primary}
            onPress={() => navigation.navigate('Employees')}
          />
          <Tile
            icon="people-circle-outline" label="All Attendance"
            sub="Daily · Weekly · Monthly" color={palette.wfh}
            onPress={() => navigation.navigate('Attendance')}
          />
        </View>

        {/* Approvals */}
        <SectionLabel title="Approvals" />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <Tile
            icon="checkmark-done-circle-outline" label="Approvals"
            sub={totalPending > 0 ? `${totalPending} pending` : 'All clear'}
            color={palette.present} badge={totalPending}
            onPress={() => navigation.navigate('Approvals')}
          />
          <Tile
            icon="pulse-outline" label="eSSL Live Sync"
            sub="Biometric data" color="#8B5CF6"
            onPress={() => navigation.navigate('More', { screen: 'EsslConnection' })}
          />
        </View>

        {/* Configuration */}
        <SectionLabel title="Configuration" />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <Tile
            icon="time-outline" label="Shifts"
            sub="Work timings" color="#EC4899"
            onPress={() => navigation.navigate('More', { screen: 'ShiftMgmt' })}
          />
          <Tile
            icon="flag-outline" label="Holidays"
            sub="Holiday calendar" color="#14B8A6"
            onPress={() => navigation.navigate('More', { screen: 'Holidays' })}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <Tile
            icon="document-text-outline" label="Policies"
            sub="Attendance rules" color="#6B7280"
            onPress={() => navigation.navigate('More', { screen: 'Policies' })}
          />
          <Tile
            icon="megaphone-outline" label="Announcements"
            sub="Post updates" color="#F97316"
            onPress={() => navigation.navigate('More', { screen: 'Announcements' })}
          />
        </View>

        {/* Tools */}
        <SectionLabel title="Tools & Reports" />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <Tile
            icon="bar-chart-outline" label="Reports"
            sub="Export attendance" color={palette.accent}
            onPress={() => navigation.navigate('More', { screen: 'Reports' })}
          />
          <Tile
            icon="finger-print-outline" label="Devices"
            sub="ESSL biometric" color="#0EA5E9"
            onPress={() => navigation.navigate('More', { screen: 'Devices' })}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile
            icon="notifications-outline" label="Notifications"
            sub={unread > 0 ? `${unread} unread` : 'All clear'}
            color={palette.primaryLight} badge={unread}
            onPress={() => navigation.navigate('Notifications')}
          />
          <Tile
            icon="settings-outline" label="Settings"
            sub="App preferences" color="#64748B"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      </View>
    </ScrollView>
  );
};

export default HRDashboardScreen;
