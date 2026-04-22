import React, { useRef, useState, useEffect } from 'react';
import { Text, TextInput, View, Pressable } from 'react-native';
import { Button } from '@/components/UI';
import { useTheme } from '@/theme';
import { useAppDispatch } from '@/store';
import { loginSuccess } from '@/store/authSlice';
import { mockUsers } from '@/mock/data';

const OTPVerifyScreen: React.FC<any> = ({ route, navigation }) => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const phone = route.params?.phone ?? '';
  const role = route.params?.role ?? 'employee';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const setDigit = (i: number, v: string) => {
    const next = [...otp];
    next[i] = v.slice(-1);
    setOtp(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (!v && i > 0) refs.current[i - 1]?.focus();
  };

  const verify = () => {
    if (otp.join('').length !== 6) return;
    setLoading(true);
    setTimeout(() => {
      const user = mockUsers.find((u) => u.role === role);
      if (user) dispatch(loginSuccess({ user, token: 'mock-jwt-' + Date.now() }));
      setLoading(false);
    }, 700);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, padding: 24, justifyContent: 'center' }}>
      <Pressable onPress={() => navigation.goBack()} style={{ alignSelf: 'flex-start', marginBottom: 24 }}>
        <Text style={{ color: t.colors.primary }}>← Back</Text>
      </Pressable>
      <Text style={{ fontSize: 24, fontWeight: '800', color: t.colors.text }}>Verify OTP</Text>
      <Text style={{ color: t.colors.textMuted, marginTop: 8 }}>
        We've sent a 6-digit code to {phone || 'your mobile'}
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, marginBottom: 20 }}>
        {otp.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => (refs.current[i] = r)}
            value={d}
            onChangeText={(v) => setDigit(i, v)}
            keyboardType="number-pad"
            maxLength={1}
            style={{
              width: 48,
              height: 56,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: t.colors.border,
              textAlign: 'center',
              fontSize: 22,
              fontWeight: '700',
              color: t.colors.text,
              backgroundColor: t.colors.inputBg,
            }}
          />
        ))}
      </View>

      <Button title="Verify & Login" onPress={verify} loading={loading} />

      <View style={{ alignItems: 'center', marginTop: 18 }}>
        {timer > 0 ? (
          <Text style={{ color: t.colors.textMuted }}>Resend OTP in {timer}s</Text>
        ) : (
          <Pressable onPress={() => setTimer(30)}>
            <Text style={{ color: t.colors.primary, fontWeight: '700' }}>Resend OTP</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

export default OTPVerifyScreen;
