import React, { useState } from 'react';
import { FlatList, Pressable, Text, View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card, EmptyState, Row } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { useAppSelector } from '@/store';

const EmployeeListScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const employees = useAppSelector((s) => s.data.employees);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'All' | 'WFO' | 'WFH' | 'Hybrid'>('All');

  const filtered = employees.filter((e) => {
    if (mode !== 'All' && e.workMode !== mode) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      e.name.toLowerCase().includes(s) ||
      e.empCode.toLowerCase().includes(s) ||
      e.email.toLowerCase().includes(s) ||
      e.department.toLowerCase().includes(s)
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, padding: 16 }}>
      <View
        style={{
          backgroundColor: t.colors.surface,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: t.colors.border,
          marginBottom: 10,
        }}
      >
        <Ionicons name="search" size={18} color={t.colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by name, code, email, dept"
          placeholderTextColor={t.colors.textMuted}
          style={{ flex: 1, color: t.colors.text }}
        />
      </View>

      <Row style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {(['All', 'WFO', 'WFH', 'Hybrid'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: mode === m ? t.colors.primary : t.colors.surface,
              borderWidth: 1,
              borderColor: mode === m ? t.colors.primary : t.colors.border,
            }}
          >
            <Text style={{ color: mode === m ? '#fff' : t.colors.text, fontWeight: '600', fontSize: 13 }}>{m}</Text>
          </Pressable>
        ))}
      </Row>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        ListEmptyComponent={<EmptyState title="No employees" />}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('EditEmployee', { userId: item.id })}>
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <Avatar name={item.name} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: t.colors.text, fontWeight: '700' }}>{item.name}</Text>
                    <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {item.empCode} · {item.department}
                    </Text>
                  </View>
                </Row>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge
                    label={item.workMode}
                    color={item.workMode === 'WFH' ? palette.wfh : item.workMode === 'WFO' ? palette.primary : palette.accent}
                  />
                  {!item.active && <Badge label="Inactive" color={t.colors.danger} />}
                </View>
              </Row>
            </Card>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => navigation.navigate('EditEmployee')}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: t.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
};

export default EmployeeListScreen;
