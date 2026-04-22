import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Input } from '@/components/UI';
import { useTheme } from '@/theme';

const ForgotPasswordScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Enter a valid email');
    setError('');
    setSent(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, padding: 24, justifyContent: 'center' }}>
      <Pressable onPress={() => navigation.goBack()} style={{ alignSelf: 'flex-start', marginBottom: 24 }}>
        <Text style={{ color: t.colors.primary }}>← Back</Text>
      </Pressable>
      <Text style={{ fontSize: 24, fontWeight: '800', color: t.colors.text }}>Forgot Password</Text>
      <Text style={{ color: t.colors.textMuted, marginTop: 8, marginBottom: 24 }}>
        Enter your registered email. We'll send you a reset link + OTP.
      </Text>
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={error} />
      <Button title={sent ? 'Resend link' : 'Send reset link'} onPress={submit} />
      {sent && (
        <View
          style={{
            marginTop: 16,
            backgroundColor: t.colors.success + '22',
            padding: 12,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: t.colors.success, fontWeight: '600' }}>
            Reset link sent. Check your email.
          </Text>
        </View>
      )}
    </View>
  );
};

export default ForgotPasswordScreen;
