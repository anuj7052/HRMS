import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button, Card, EmptyState, Input, Row, SectionHeader } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { addNotification } from '@/store/dataSlice';

const AnnouncementsScreen: React.FC = () => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const announcements = useAppSelector((s) =>
    s.data.notifications.filter((n) => n.category === 'announcement')
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');

  const send = () => {
    if (!title.trim() || !body.trim()) return setErr('Title and body are required');
    setErr('');
    dispatch(
      addNotification({
        id: 'n-' + Date.now(),
        title: title.trim(),
        body: body.trim(),
        category: 'announcement',
        read: false,
        createdAt: new Date().toISOString(),
      })
    );
    setTitle('');
    setBody('');
    Alert.alert('Sent', 'Announcement broadcast to all employees.');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <Text style={{ color: t.colors.text, fontWeight: '700', marginBottom: 10 }}>New announcement</Text>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Holiday notice" />
        <Input label="Message" value={body} onChangeText={setBody} placeholder="Write details…" multiline error={err} />
        <Button title="Broadcast" onPress={send} />
      </Card>

      <SectionHeader title="Previous announcements" />
      {announcements.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        announcements.map((n) => (
          <Card key={n.id} style={{ marginBottom: 10 }}>
            <Text style={{ color: t.colors.text, fontWeight: '700' }}>{n.title}</Text>
            <Text style={{ color: t.colors.textMuted, marginTop: 4 }}>{n.body}</Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 6 }}>
              {new Date(n.createdAt).toLocaleString()}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
};

export default AnnouncementsScreen;
