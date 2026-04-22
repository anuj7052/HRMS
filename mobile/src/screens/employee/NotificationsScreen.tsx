import React, { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, EmptyState, Row } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { markAllNotificationsRead, markNotificationRead } from '@/store/dataSlice';

const CAT_ICON: Record<string, any> = {
  wfh: 'home-outline',
  leave: 'airplane-outline',
  attendance: 'time-outline',
  correction: 'create-outline',
  announcement: 'megaphone-outline',
};

const NotificationsScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.data.notifications);
  const [filter, setFilter] = useState<'All' | 'Unread'>('All');
  const data = filter === 'All' ? items : items.filter((i) => !i.read);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, padding: 16 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Row style={{ gap: 8 }}>
          {(['All', 'Unread'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: filter === f ? t.colors.primary : t.colors.surface,
                borderWidth: 1,
                borderColor: filter === f ? t.colors.primary : t.colors.border,
              }}
            >
              <Text style={{ color: filter === f ? '#fff' : t.colors.text, fontWeight: '600' }}>{f}</Text>
            </Pressable>
          ))}
        </Row>
        <Pressable onPress={() => dispatch(markAllNotificationsRead())}>
          <Text style={{ color: t.colors.primary, fontWeight: '600' }}>Mark all read</Text>
        </Pressable>
      </Row>

      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListEmptyComponent={<EmptyState title="No notifications" />}
        renderItem={({ item }) => (
          <Pressable onPress={() => dispatch(markNotificationRead(item.id))}>
            <Card style={{ opacity: item.read ? 0.75 : 1 }}>
              <Row>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: t.colors.primary + '18',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={CAT_ICON[item.category]} size={20} color={t.colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={{ color: t.colors.text, fontWeight: '700' }}>{item.title}</Text>
                    {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.danger }} />}
                  </Row>
                  <Text style={{ color: t.colors.textMuted, marginTop: 4 }}>{item.body}</Text>
                  <Badge label={item.category.toUpperCase()} style={{ marginTop: 8 }} />
                </View>
              </Row>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
};

export default NotificationsScreen;
