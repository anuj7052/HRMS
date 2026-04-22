import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Row, SectionHeader } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { addEmployee, deactivateEmployee, updateEmployee } from '@/store/dataSlice';
import { JobRole, JOB_ROLE_GROUPS, ShiftType, WorkMode, jobRoleToSystemRole } from '@/types';

const WORK_MODES: WorkMode[] = ['WFO', 'WFH', 'Hybrid'];
const SHIFTS: ShiftType[] = ['Morning', 'Evening', 'Night', 'Flexible'];

/** Auto-generate an employee code from name + timestamp suffix */
const genEmpCode = (name: string) => {
  const initials = name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 3) || 'EMP';
  return `${initials}${String(Date.now()).slice(-4)}`;
};

const EditEmployeeScreen: React.FC<any> = ({ route, navigation }) => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const existing = useAppSelector((s) =>
    route.params?.userId ? s.data.employees.find((e) => e.id === route.params.userId) : undefined
  );

  const [form, setForm] = useState({
    name: existing?.name ?? '',
    empCode: existing?.empCode ?? '',
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    department: existing?.department ?? '',
    designation: existing?.designation ?? '',
    jobRole: (existing?.jobRole ?? 'Executive') as JobRole,
    workMode: (existing?.workMode ?? 'WFO') as WorkMode,
    shift: (existing?.shift ?? 'Morning') as ShiftType,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  // Auto-fill emp code when name is typed for new employees
  const handleNameChange = (v: string) => {
    setForm((f) => ({
      ...f,
      name: v,
      empCode: existing ? f.empCode : genEmpCode(v),
    }));
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.empCode.trim()) e.empCode = 'Required';
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    if (!/^\+?\d{7,14}$/.test(form.phone.replace(/[\s\-+]/g, ''))) e.phone = 'Valid phone required (7-14 digits)';
    if (!form.department.trim()) e.department = 'Required';
    setErrors(e);
    if (Object.keys(e).length) return;

    // Auto-derive system role from job role
    const systemRole = jobRoleToSystemRole(form.jobRole);
    // Use designation as job role label if not filled
    const designation = form.designation.trim() || form.jobRole;

    if (existing) {
      dispatch(updateEmployee({ ...existing, ...form, designation, role: systemRole }));
      Alert.alert('Saved', `${form.name} updated.\nJob Role: ${form.jobRole} → Access: ${systemRole.toUpperCase()}`);
      navigation.goBack();
    } else {
      const empCode = form.empCode.trim();
      dispatch(
        addEmployee({
          id: 'u-' + Date.now(),
          name: form.name.trim(),
          empCode,
          email: form.email.trim(),
          phone: form.phone.trim(),
          department: form.department.trim(),
          designation,
          jobRole: form.jobRole,
          role: systemRole,
          workMode: form.workMode,
          shift: form.shift,
          active: true,
          joinedOn: new Date().toISOString().split('T')[0],
        })
      );
      setGeneratedCode(empCode);
      Alert.alert(
        'Employee Created ✓',
        `Name: ${form.name}\nEmployee ID: ${empCode}\nJob Role: ${form.jobRole}\nAccess Level: ${systemRole.toUpperCase()}\n\nShare Employee ID as login. Default password = Employee ID.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const deactivate = () => {
    if (!existing) return;
    Alert.alert('Deactivate', `Deactivate ${existing.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: () => {
          dispatch(deactivateEmployee(existing.id));
          navigation.goBack();
        },
      },
    ]);
  };

  const Chip = <T extends string>({ label, active, onPress }: { label: T; active: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginRight: 6, marginBottom: 6,
        backgroundColor: active ? t.colors.primary : t.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: active ? t.colors.primary : t.colors.border,
      }}
    >
      <Text style={{ color: active ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  const derivedRole = jobRoleToSystemRole(form.jobRole);
  const roleColor = derivedRole === 'hr' ? '#8B5CF6' : derivedRole === 'manager' ? '#F59E0B' : '#16A34A';
  const roleLabel = derivedRole === 'hr' ? 'Full Admin Access (HR/CEO/Director panel)'
    : derivedRole === 'manager' ? 'Manager Access (team management panel)'
    : 'Employee Access (self-service panel)';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>

      {/* ── Basic Info ─────────────────────────────────────────────────── */}
      <Card>
        <Input label="Full name *" value={form.name} onChangeText={handleNameChange} error={errors.name} placeholder="e.g. Anuj Singh" />
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Employee ID *" value={form.empCode} onChangeText={(v) => setForm({ ...form, empCode: v.toUpperCase() })} error={errors.empCode} placeholder="Auto-generated" autoCapitalize="characters" />
          </View>
        </Row>
        <Input label="Email *" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" error={errors.email} placeholder="name@company.com" />
        <Input label="Phone *" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" error={errors.phone} placeholder="+91 98xxxxxxxx" />
        <Input label="Department *" value={form.department} onChangeText={(v) => setForm({ ...form, department: v })} error={errors.department} placeholder="e.g. Engineering" />
        <Input label="Display title (optional)" value={form.designation} onChangeText={(v) => setForm({ ...form, designation: v })} placeholder={`Defaults to "${form.jobRole}"`} />
      </Card>

      {/* ── Job Role ───────────────────────────────────────────────────── */}
      <SectionHeader title="Job Role  ·  determines access level" />
      {JOB_ROLE_GROUPS.map((group) => (
        <View key={group.label} style={{ marginBottom: 12 }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
            {group.label}
          </Text>
          <Row style={{ flexWrap: 'wrap' }}>
            {group.roles.map((r) => (
              <Chip key={r} label={r} active={form.jobRole === r} onPress={() => setForm({ ...form, jobRole: r })} />
            ))}
          </Row>
        </View>
      ))}

      {/* Access level preview */}
      <View style={{
        borderRadius: 12, padding: 14, marginBottom: 4,
        backgroundColor: roleColor + '18',
        borderWidth: 1, borderColor: roleColor + '55',
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <Ionicons name="shield-checkmark-outline" size={20} color={roleColor} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: roleColor, fontWeight: '800', fontSize: 14 }}>
            {form.jobRole}
          </Text>
          <Text style={{ color: roleColor, fontSize: 12, marginTop: 2 }}>{roleLabel}</Text>
        </View>
      </View>

      {/* ── Work Mode & Shift ──────────────────────────────────────────── */}
      <SectionHeader title="Work mode" />
      <Row style={{ flexWrap: 'wrap' }}>
        {WORK_MODES.map((m) => (
          <Chip key={m} label={m} active={form.workMode === m} onPress={() => setForm({ ...form, workMode: m })} />
        ))}
      </Row>

      <SectionHeader title="Shift" />
      <Row style={{ flexWrap: 'wrap' }}>
        {SHIFTS.map((s) => (
          <Chip key={s} label={s} active={form.shift === s} onPress={() => setForm({ ...form, shift: s })} />
        ))}
      </Row>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <View style={{ marginTop: 20, gap: 10 }}>
        <Button title={existing ? 'Save changes' : `Add employee · ${form.jobRole}`} onPress={submit} />
        {existing && (
          <Button
            title={existing.active ? 'Deactivate employee' : 'Already inactive'}
            variant="danger"
            onPress={deactivate}
            disabled={!existing.active}
          />
        )}
      </View>

      {!existing && (
        <Card style={{ marginTop: 16, backgroundColor: t.colors.surfaceAlt }}>
          <Row style={{ gap: 8 }}>
            <Ionicons name="information-circle-outline" size={18} color={t.colors.textMuted} />
            <Text style={{ color: t.colors.textMuted, fontSize: 12, flex: 1 }}>
              After creation, share the <Text style={{ fontWeight: '700' }}>Employee ID</Text> with the employee. They can log in using their ID — default password is their Employee ID.
            </Text>
          </Row>
        </Card>
      )}
    </ScrollView>
  );
};

export default EditEmployeeScreen;
