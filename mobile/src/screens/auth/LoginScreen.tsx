import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { useAppDispatch } from '@/store';
import { loginSuccess } from '@/store/authSlice';
import { loginWithCredentials } from '@/services/api';

const LoginScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!identifier.trim()) e.identifier = 'Enter your email address';
    if (!password) e.password = 'Enter your password';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await loginWithCredentials(identifier.trim().toLowerCase(), password);
      dispatch(loginSuccess({
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: (data.user.role?.toLowerCase() as any) || 'employee',
          empCode: data.user.id,
          phone: '',
          department: '',
          designation: '',
          joinedOn: '',
          active: true,
          workMode: 'WFO',
          avatar: '',
          shift: 'Flexible' as any,
        },
        token: data.accessToken,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.toLowerCase().includes('unable to reach backend') || message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('network request failed')) {
        Alert.alert(
          'Connection error',
          `The app could not reach the HRMS backend.\n\n${message}\n\nFix: ensure your phone and Mac are on the same Wi-Fi, or set EXPO_PUBLIC_API_BASE_URL=http://<your-mac-ip>:5000/api before running expo start.`
        );
        setErrors({ identifier: 'Cannot reach backend server' });
      } else {
        setErrors({ password: message || 'Invalid credentials' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>

        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="briefcase" size={38} color="#fff" />
          </View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: t.colors.text, marginTop: 14 }}>SmartHRMS</Text>
          <Text style={{ color: t.colors.textMuted, marginTop: 4 }}>Workforce on your fingertips</Text>
        </View>

        {/* Credentials */}
        <Input
          label="Email Address"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="e.g. rahul@foetron.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.identifier}
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Enter your password"
          error={errors.password}
        />

        <Button title="Login" onPress={onLogin} loading={loading} />

        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'center', marginTop: 16 }}>
          <Text style={{ color: t.colors.primary, fontWeight: '600' }}>Forgot password?</Text>
        </Pressable>

        {/* Demo hint */}
        <View style={{ marginTop: 24, padding: 12, borderRadius: 10, backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border }}>
          <Text style={{ color: t.colors.textMuted, fontSize: 12 }}>
            <Text style={{ fontWeight: '700' }}>Demo: </Text>
            anuj@foetron.com / Admin@1234  ·  rahul@foetron.com / Employee@123
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
