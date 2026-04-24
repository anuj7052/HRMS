import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Button, Card, Input, Row, SectionHeader } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { getEmployeeById, updateEmployeeById, type EmployeeAPI } from '@/services/api';

// ── Info row helper ───────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) => {
  const t = useTheme();
  return (
    <Row style={{ gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.colors.border + '40' }}>
      <Ionicons name={icon as any} size={18} color={color ?? t.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
        <Text style={{ color: t.colors.text, fontSize: 14, marginTop: 2, fontWeight: '500' }}>{value || '—'}</Text>
      </View>
    </Row>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
const EditEmployeeScreen: React.FC<any> = ({ route, navigation }) => {
  const t = useTheme();
  const employeeId: string | undefined = route.params?.employeeId;

  const [emp, setEmp] = useState<EmployeeAPI | null>(null);
  const [loading, setLoading] = useState(!!employeeId);
  const [editing, setEditing] = useState(!employeeId); // new employee → straight to edit
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [form, setForm] = useState({
    name: '', department: '', designation: '', phone: '', address: '', emergencyContact: '',
  });

  // Fetch employee if editing existing
  useEffect(() => {
    if (!employeeId) return;
    (async () => {
      try {
        const data = await getEmployeeById(employeeId);
        setEmp(data);
        setForm({
          name: data.user?.name ?? '',
          department: data.department ?? '',
          designation: data.designation ?? '',
          phone: data.phone ?? '',
          address: '',
          emergencyContact: '',
        });
      } catch {
        Alert.alert('Error', 'Could not load employee profile.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [employeeId]);

  const handleSave = async () => {
    if (!emp) return;
    if (!form.name.trim() || !form.department.trim() || !form.designation.trim()) {
      Alert.alert('Validation', 'Name, Department and Designation are required.');
      return;
    }
    setSaving(true);
    try {
      await updateEmployeeById(emp.id, {
        name: form.name.trim(),
        department: form.department.trim(),
        designation: form.designation.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
      });
      // Refresh
      const updated = await getEmployeeById(emp.id);
      setEmp(updated);
      setForm({
        name: updated.user?.name ?? '',
        department: updated.department,
        designation: updated.designation,
        phone: updated.phone ?? '',
        address: '',
        emergencyContact: '',
      });
      setEditing(false);
      Alert.alert('Saved', 'Employee profile updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = () => {
    if (!emp) return;
    const action = emp.isActive ? 'deactivate' : 'reactivate';
    Alert.alert(
      `${emp.isActive ? 'Deactivate' : 'Reactivate'} Employee`,
      `Are you sure you want to ${action} ${emp.user?.name ?? 'this employee'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: emp.isActive ? 'Deactivate' : 'Reactivate',
          style: emp.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updateEmployeeById(emp.id, { isActive: !emp.isActive });
              setEmp({ ...emp, isActive: !emp.isActive });
            } catch {
              Alert.alert('Error', 'Could not update status.');
            }
          },
        },
      ],
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={t.colors.primary} />
        <Text style={{ color: t.colors.textMuted, marginTop: 12 }}>Loading profile…</Text>
      </View>
    );
  }

  // ── Profile view ───────────────────────────────────────────────────────────
  if (emp && !editing) {
    const joinDate = emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const roleColor = emp.user?.role === 'HR' ? '#8B5CF6' : emp.user?.role === 'Manager' ? '#F59E0B' : t.colors.primary;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Profile Header ─────────────────────────────────────────── */}
        <View style={{
          backgroundColor: t.colors.surface,
          paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24,
          alignItems: 'center', borderBottomWidth: 1, borderBottomColor: t.colors.border,
        }}>
          <Avatar name={emp.user?.name ?? ''} size={72} />
          <Text style={{ color: t.colors.text, fontSize: 22, fontWeight: '800', marginTop: 14, textAlign: 'center' }}>
            {emp.user?.name ?? '—'}
          </Text>
          <Text style={{ color: t.colors.textMuted, fontSize: 14, marginTop: 4 }}>
            {emp.designation}
          </Text>
          <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Badge
              label={emp.employeeId}
              color={t.colors.primary}
            />
            <Badge
              label={emp.isActive ? 'Active' : 'Inactive'}
              color={emp.isActive ? palette.present : palette.absent}
            />
            {emp.user?.role && (
              <Badge label={emp.user.role} color={roleColor} />
            )}
          </Row>
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          {/* ── Contact Info ─────────────────────────────────────────── */}
          <Card>
            <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              Contact
            </Text>
            <InfoRow icon="mail-outline" label="Email" value={emp.user?.email ?? '—'} />
            <InfoRow icon="call-outline" label="Phone" value={emp.phone ?? '—'} />
          </Card>

          {/* ── Job Info ──────────────────────────────────────────────── */}
          <Card>
            <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              Job Details
            </Text>
            <InfoRow icon="business-outline" label="Department" value={emp.department} />
            <InfoRow icon="briefcase-outline" label="Designation" value={emp.designation} />
            <InfoRow icon="calendar-outline" label="Joined On" value={joinDate} />
          </Card>

          {/* ── Actions ──────────────────────────────────────────────── */}
          <Button
            title="Edit Profile"
            onPress={() => setEditing(true)}
          />
          <Button
            title={emp.isActive ? 'Deactivate Employee' : 'Reactivate Employee'}
            variant={emp.isActive ? 'danger' : 'secondary'}
            onPress={handleToggleActive}
          />
          <Pressable
            onPress={() => navigation.navigate('EmployeeAttendanceProfile', { employeeId: emp.id, name: emp.user?.name ?? '' })}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 12, borderRadius: 10,
              backgroundColor: t.colors.primary + '15',
              borderWidth: 1, borderColor: t.colors.primary + '40',
            }}
          >
            <Ionicons name="calendar-outline" size={18} color={t.colors.primary} />
            <Text style={{ color: t.colors.primary, fontWeight: '700', fontSize: 15 }}>View Attendance</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ── Edit form ──────────────────────────────────────────────────────────────
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Card>
        <SectionHeader title="Basic Info" />
        <Input
          label="Full Name *"
          value={form.name}
          onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
          placeholder="e.g. Anuj Singh"
        />
        <Input
          label="Department *"
          value={form.department}
          onChangeText={(v) => setForm((f) => ({ ...f, department: v }))}
          placeholder="e.g. Tech Support Group"
        />
        <Input
          label="Designation *"
          value={form.designation}
          onChangeText={(v) => setForm((f) => ({ ...f, designation: v }))}
          placeholder="e.g. Senior Engineer"
        />
        <Input
          label="Phone"
          value={form.phone}
          onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
          keyboardType="phone-pad"
          placeholder="+91 98xxxxxxxx"
        />
        <Input
          label="Address"
          value={form.address}
          onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
          placeholder="Office / home address"
        />
        <Input
          label="Emergency Contact"
          value={form.emergencyContact}
          onChangeText={(v) => setForm((f) => ({ ...f, emergencyContact: v }))}
          keyboardType="phone-pad"
          placeholder="Emergency contact number"
        />
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />
        {emp && (
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setEditing(false)}
            disabled={saving}
          />
        )}
      </View>
    </ScrollView>
  );
};

export default EditEmployeeScreen;
