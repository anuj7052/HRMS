import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card, Row, SectionHeader } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { logout } from '@/store/authSlice';
import { jobRoleToSystemRole } from '@/types';
import { getEmployeeProfile, type EmployeeAPI } from '@/services/api';

const ProfileScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const effectiveRole = user.jobRole ? jobRoleToSystemRole(user.jobRole) : user.role;
  const accessLabel = effectiveRole === 'hr' ? 'Full Admin Access'
    : effectiveRole === 'manager' ? 'Manager Access'
    : 'Employee Access';
  const accessColor = effectiveRole === 'hr' ? '#8B5CF6'
    : effectiveRole === 'manager' ? '#F59E0B'
    : '#16A34A';

  const [profile, setProfile] = useState<EmployeeAPI | null>(null);

  useEffect(() => {
    getEmployeeProfile().then(setProfile).catch(() => {/* ignore */});
  }, []);

  const phone      = profile?.phone ?? '';
  const department = profile?.department ?? profile?.user?.department ?? '';
  const designation = profile?.designation ?? '';
  const empCode    = profile?.employeeId ?? user.empCode ?? '';
  const joinDate   = profile?.joinDate ? new Date(profile.joinDate).toLocaleDateString() : '';

  const Item: React.FC<{ icon: any; label: string; onPress?: () => void; danger?: boolean }> = ({
    icon,
    label,
    onPress,
    danger,
  }) => (
    <Pressable onPress={onPress}>
      <Row style={{ justifyContent: 'space-between', paddingVertical: 14 }}>
        <Row style={{ gap: 12 }}>
          <Ionicons name={icon} size={20} color={danger ? t.colors.danger : t.colors.primary} />
          <Text style={{ color: danger ? t.colors.danger : t.colors.text, fontWeight: '600' }}>{label}</Text>
        </Row>
        {!danger && <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />}
      </Row>
    </Pressable>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Row>
          <Avatar name={user.name} size={64} />
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={{ color: t.colors.text, fontWeight: '800', fontSize: 18 }}>{user.name}</Text>
            <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>{designation || user.designation}</Text>
            <Row style={{ gap: 6, marginTop: 8 }}>
              {empCode ? <Badge label={empCode} /> : null}
              <Badge
                label={user.workMode}
                color={user.workMode === 'WFH' ? palette.wfh : user.workMode === 'WFO' ? palette.primary : palette.accent}
              />
              {user.jobRole && <Badge label={user.jobRole} color={accessColor} />}
            </Row>
            <View style={{
              marginTop: 8, paddingVertical: 4, paddingHorizontal: 10,
              borderRadius: 8, backgroundColor: accessColor + '18',
              alignSelf: 'flex-start',
            }}>
              <Text style={{ color: accessColor, fontWeight: '700', fontSize: 12 }}>{accessLabel}</Text>
            </View>
          </View>
        </Row>
        <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 12 }} />
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Email</Text>
            <Text style={{ color: t.colors.text }}>{user.email}</Text>
          </View>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <View>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Phone</Text>
            <Text style={{ color: t.colors.text }}>{phone || '—'}</Text>
          </View>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
          <View>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Department</Text>
            <Text style={{ color: t.colors.text }}>{department || '—'}</Text>
          </View>
          <View>
            <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>Join Date</Text>
            <Text style={{ color: t.colors.text }}>{joinDate || '—'}</Text>
          </View>
        </Row>
      </Card>

      <SectionHeader title="Account" />
      <Card>
        <Item icon="lock-closed-outline" label="Change Password" onPress={() => navigation.navigate?.('ChangePassword')} />
        <View style={{ height: 1, backgroundColor: t.colors.border }} />
        <Item icon="settings-outline" label="Settings" onPress={() => navigation.navigate?.('Settings')} />
        <View style={{ height: 1, backgroundColor: t.colors.border }} />
        <Item icon="help-circle-outline" label="Help & Support" onPress={() => navigation.navigate?.('HelpSupport')} />
      </Card>

      <View style={{ marginTop: 16 }}>
        <Card>
          <Item icon="log-out-outline" label="Logout" onPress={() => dispatch(logout())} danger />
        </Card>
      </View>
    </ScrollView>
  );
};

export default ProfileScreen;
