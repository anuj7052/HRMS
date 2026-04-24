import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card, EmptyState, Row } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { getEmployees, type EmployeeAPI } from '@/services/api';

const EmployeeListScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const [employees, setEmployees] = useState<EmployeeAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const fetchEmployees = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await getEmployees({ page: p, limit: 30, search: debouncedQ || undefined });
      setEmployees(p === 1 ? res.data : (prev) => [...prev, ...res.data]);
      setTotalPages(res.pages);
      setPage(p);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [debouncedQ]);

  useEffect(() => { fetchEmployees(1); }, [fetchEmployees]);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, padding: 16 }}>
      <View style={{
        backgroundColor: t.colors.surface, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderColor: t.colors.border, marginBottom: 10,
      }}>
        <Ionicons name="search" size={18} color={t.colors.textMuted} />
        <TextInput
          value={q} onChangeText={setQ}
          placeholder="Search by name, ID, department"
          placeholderTextColor={t.colors.textMuted}
          style={{ flex: 1, color: t.colors.text }}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')}>
            <Ionicons name="close-circle" size={18} color={t.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {loading && employees.length === 0 ? (
        <ActivityIndicator color={t.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
          ListEmptyComponent={<EmptyState title="No employees found" />}
          onEndReached={() => { if (page < totalPages && !loading) fetchEmployees(page + 1); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loading && employees.length > 0 ? <ActivityIndicator color={t.colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('EmployeeAttendanceProfile', { employeeId: item.id, name: item.user.name })}>
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row style={{ flex: 1 }}>
                    <Avatar name={item.user.name} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: t.colors.text, fontWeight: '700' }}>{item.user.name}</Text>
                      <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                        {item.employeeId} · {item.department}
                      </Text>
                      <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 1 }}>{item.designation}</Text>
                    </View>
                  </Row>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge
                      label={item.isActive ? 'Active' : 'Inactive'}
                      color={item.isActive ? palette.present : palette.absent}
                    />
                  </View>
                </Row>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Pressable
        onPress={() => navigation.navigate('EditEmployee')}
        style={{
          position: 'absolute', right: 16, bottom: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: t.colors.primary,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
};

export default EmployeeListScreen;
