import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Button, Input } from '@/components/UI';
import { useTheme } from '@/theme';

const ChangePasswordScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (!cur) e.cur = 'Enter current password';
    if (next.length < 8) e.next = 'Min 8 characters';
    if (!/[A-Z]/.test(next) || !/\d/.test(next)) e.next = 'Include uppercase + number';
    if (next !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length) return;
    Alert.alert('Updated', 'Password changed successfully.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: t.colors.textMuted, marginBottom: 14 }}>
        Passwords must be at least 8 characters and include an uppercase letter and number.
      </Text>
      <Input label="Current password" value={cur} onChangeText={setCur} secureTextEntry error={errors.cur} />
      <Input label="New password" value={next} onChangeText={setNext} secureTextEntry error={errors.next} />
      <Input label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry error={errors.confirm} />
      <Button title="Update password" onPress={submit} />
    </ScrollView>
  );
};

export default ChangePasswordScreen;
