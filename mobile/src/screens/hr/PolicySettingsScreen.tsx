import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Input, Row, SectionHeader } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { setCheckInControl, upsertPolicy } from '@/store/dataSlice';
import { getCheckInSettings, saveCheckInSettings } from '@/services/api';
import { Policy } from '@/types';

const PolicySettingsScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const policies = useAppSelector((s) => s.data.policies);
  const checkInControl = useAppSelector((s) => s.data.checkInControl);
  const employees = useAppSelector((s) => s.data.employees);

  const [editing, setEditing] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // local copy for editing before saving
  const [ctrl, setCtrl] = useState(checkInControl);
  // department input (comma-separated)
  const [deptInput, setDeptInput] = useState(checkInControl.departments.join(', '));
  // employee search
  const [empSearch, setEmpSearch] = useState('');

  // Load from backend on mount
  useEffect(() => {
    getCheckInSettings()
      .then((s) => {
        dispatch(setCheckInControl(s));
        setCtrl(s);
        setDeptInput(s.departments.join(', '));
      })
      .catch(() => { /* offline — use Redux */ })
      .finally(() => setLoading(false));
  }, []);

  const saveCtrl = async () => {
    setSaving(true);
    try {
      const finalCtrl = {
        ...ctrl,
        departments: ctrl.scope === 'department'
          ? deptInput.split(',').map((d) => d.trim()).filter(Boolean)
          : [],
        employeeIds: ctrl.scope === 'employee' ? ctrl.employeeIds : [],
      };
      await saveCheckInSettings(finalCtrl);
      dispatch(setCheckInControl(finalCtrl));
      Alert.alert('Saved', 'Check-in control settings updated.');
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEmployee = (id: string) => {
    setCtrl((prev) => ({
      ...prev,
      employeeIds: prev.employeeIds.includes(id)
        ? prev.employeeIds.filter((e) => e !== id)
        : [...prev.employeeIds, id],
    }));
  };

  const filteredEmployees = employees.filter((e) =>
    empSearch.length === 0 ||
    e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.department ?? '').toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.empCode ?? '').toLowerCase().includes(empSearch.toLowerCase())
  );

  // Unique departments from employees
  const allDepartments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean) as string[])).sort();

  const scopeLabels: { scope: typeof ctrl.scope; icon: any; label: string; desc: string }[] = [
    { scope: 'global', icon: 'globe-outline', label: 'Global', desc: 'All employees can check in' },
    { scope: 'department', icon: 'business-outline', label: 'Department', desc: 'Only selected departments' },
    { scope: 'employee', icon: 'person-outline', label: 'Employee', desc: 'Only selected individuals' },
  ];

  const startEdit = (p: Policy) => setEditing({ ...p });
  const save = () => {
    if (!editing) return;
    dispatch(upsertPolicy(editing));
    Alert.alert('Saved', 'Policy updated.');
    setEditing(null);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>

      {/* ── App Check-In Control ─────────────────────────────────────── */}
      <SectionHeader title="App Check-In Control" />

      {loading ? (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={t.colors.primary} />
          <Text style={{ color: t.colors.textMuted, marginTop: 8 }}>Loading settings…</Text>
        </Card>
      ) : (
        <>
          {/* Master on/off toggle */}
          <Card style={{ marginBottom: 12 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15 }}>
                  Allow App Check-In / Check-Out
                </Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                  Master switch. When off, all employees must use biometric devices only.
                </Text>
              </View>
              <Switch
                value={ctrl.enabled}
                onValueChange={(val) => setCtrl((p) => ({ ...p, enabled: val }))}
                trackColor={{ false: t.colors.border, true: t.colors.success }}
                thumbColor="#fff"
              />
            </Row>
          </Card>

          {ctrl.enabled && (
            <>
              {/* Scope selector */}
              <Card style={{ marginBottom: 12 }}>
                <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 12 }}>
                  Who can use app check-in?
                </Text>
                {scopeLabels.map(({ scope, icon, label, desc }) => (
                  <Pressable
                    key={scope}
                    onPress={() => setCtrl((p) => ({ ...p, scope }))}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      padding: 12, borderRadius: 12, marginBottom: 8,
                      backgroundColor: ctrl.scope === scope
                        ? t.colors.primary + '18' : t.colors.surfaceAlt,
                      borderWidth: 1.5,
                      borderColor: ctrl.scope === scope ? t.colors.primary : 'transparent',
                    }}
                  >
                    <View style={{
                      width: 38, height: 38, borderRadius: 10,
                      backgroundColor: ctrl.scope === scope ? t.colors.primary + '28' : t.colors.border + '40',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={icon} size={20} color={ctrl.scope === scope ? t.colors.primary : t.colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.colors.text, fontWeight: '700' }}>{label}</Text>
                      <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>{desc}</Text>
                    </View>
                    {ctrl.scope === scope && (
                      <Ionicons name="checkmark-circle" size={22} color={t.colors.primary} />
                    )}
                  </Pressable>
                ))}
              </Card>

              {/* Department picker */}
              {ctrl.scope === 'department' && (
                <Card style={{ marginBottom: 12 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 10 }}>
                    Select Departments
                  </Text>
                  {allDepartments.length > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {allDepartments.map((dept) => {
                        const selected = deptInput.split(',').map((d) => d.trim()).includes(dept);
                        return (
                          <Pressable
                            key={dept}
                            onPress={() => {
                              const current = deptInput.split(',').map((d) => d.trim()).filter(Boolean);
                              const next = selected
                                ? current.filter((d) => d !== dept)
                                : [...current, dept];
                              setDeptInput(next.join(', '));
                            }}
                            style={{
                              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                              backgroundColor: selected ? t.colors.primary : t.colors.surfaceAlt,
                              borderWidth: 1,
                              borderColor: selected ? t.colors.primary : t.colors.border,
                            }}
                          >
                            <Text style={{ color: selected ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 13 }}>
                              {dept}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={{ color: t.colors.textMuted, fontSize: 13 }}>
                      No departments found. Add manually below:
                    </Text>
                  )}
                  <View style={{ marginTop: 12 }}>
                  <Input
                    label="Or type departments (comma-separated)"
                    value={deptInput}
                    onChangeText={setDeptInput}
                    placeholder="e.g. Engineering, HR, Sales"
                  />
                  </View>
                  {deptInput.trim().length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {deptInput.split(',').map((d) => d.trim()).filter(Boolean).map((d) => (
                        <Badge key={d} label={d} color={t.colors.primary} />
                      ))}
                    </View>
                  )}
                </Card>
              )}

              {/* Employee picker */}
              {ctrl.scope === 'employee' && (
                <Card style={{ marginBottom: 12 }}>
                  <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 10 }}>
                    Select Employees ({ctrl.employeeIds.length} selected)
                  </Text>
                  <View style={{ marginBottom: 10 }}>
                  <Input
                    label="Search by name, department, or code"
                    value={empSearch}
                    onChangeText={setEmpSearch}
                    placeholder="Search…"
                  />
                  </View>
                  {filteredEmployees.slice(0, 30).map((emp) => {
                    const selected = ctrl.employeeIds.includes(emp.id);
                    return (
                      <Pressable
                        key={emp.id}
                        onPress={() => toggleEmployee(emp.id)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 12,
                          paddingVertical: 10, paddingHorizontal: 12,
                          borderRadius: 10, marginBottom: 6,
                          backgroundColor: selected ? t.colors.primary + '14' : t.colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: selected ? t.colors.primary : t.colors.border,
                        }}
                      >
                        <View style={{
                          width: 36, height: 36, borderRadius: 18,
                          backgroundColor: t.colors.primary + '28',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ color: t.colors.primary, fontWeight: '800', fontSize: 14 }}>
                            {emp.name[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: t.colors.text, fontWeight: '700' }}>{emp.name}</Text>
                          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
                            {emp.empCode} · {emp.department ?? 'No Dept'}
                          </Text>
                        </View>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={selected ? t.colors.primary : t.colors.border}
                        />
                      </Pressable>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <Text style={{ color: t.colors.textMuted, textAlign: 'center', paddingVertical: 16 }}>
                      No employees found
                    </Text>
                  )}
                </Card>
              )}

              {/* Current status summary */}
              <View style={{
                paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, marginBottom: 12,
                backgroundColor: t.colors.success + '18',
              }}>
                <Text style={{ color: t.colors.success, fontWeight: '700', fontSize: 13 }}>
                  ✓ App check-in enabled
                  {ctrl.scope === 'global' && ' for all employees'}
                  {ctrl.scope === 'department' && ` for: ${deptInput.trim() || '(no departments selected)'}`}
                  {ctrl.scope === 'employee' && ` for ${ctrl.employeeIds.length} employee(s)`}
                </Text>
              </View>
            </>
          )}

          {!ctrl.enabled && (
            <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, marginBottom: 12, backgroundColor: t.colors.danger + '18' }}>
              <Text style={{ color: t.colors.danger, fontWeight: '700', fontSize: 13 }}>
                ✕ App check-in disabled — biometric devices only
              </Text>
            </View>
          )}

          <Button title={saving ? 'Saving…' : 'Save Check-In Settings'} onPress={saveCtrl} loading={saving} style={{ marginBottom: 20 }} />
        </>
      )}

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
                  flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
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
