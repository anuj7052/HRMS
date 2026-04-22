import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, Input, Row, SectionHeader } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { addHoliday, removeHoliday } from '@/store/dataSlice';

const HolidayMasterScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const holidays = useAppSelector((s) => [...s.data.holidays].sort((a, b) => a.date.localeCompare(b.date)));
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [optional, setOptional] = useState(false);
  const [err, setErr] = useState('');

  const add = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('Date must be YYYY-MM-DD');
    if (!name.trim()) return setErr('Enter holiday name');
    setErr('');
    dispatch(addHoliday({ id: 'h-' + Date.now(), date, name: name.trim(), optional }));
    setDate('');
    setName('');
    setOptional(false);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 10 }}>Add holiday</Text>
        <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-12-25" />
        <Input label="Name" value={name} onChangeText={setName} placeholder="Christmas" error={err} />
        <Pressable
          onPress={() => setOptional(!optional)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              borderWidth: 2,
              borderColor: t.colors.primary,
              backgroundColor: optional ? t.colors.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {optional && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={{ color: t.colors.text }}>Optional holiday</Text>
        </Pressable>
        <Button title="Add holiday" onPress={add} />
      </Card>

      <SectionHeader title="Holiday list" />
      {holidays.length === 0 ? (
        <EmptyState title="No holidays" />
      ) : (
        holidays.map((h) => (
          <Card key={h.id} style={{ marginBottom: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: t.colors.text, fontWeight: '700' }}>{h.name}</Text>
                <Text style={{ color: t.colors.textMuted, fontSize: 12, marginTop: 2 }}>{h.date}</Text>
              </View>
              <Row style={{ gap: 8 }}>
                {h.optional && <Badge label="Optional" color={t.colors.info} />}
                <Pressable onPress={() => Alert.alert('Remove?', h.name, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => dispatch(removeHoliday(h.id)) },
                ])}>
                  <Ionicons name="trash-outline" size={20} color={t.colors.danger} />
                </Pressable>
              </Row>
            </Row>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

export default HolidayMasterScreen;
