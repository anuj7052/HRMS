import React, { useState } from 'react';
import { ScrollView, Text, View, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/UI';
import { palette, useTheme } from '@/theme';
import { useAppDispatch } from '@/store';
import { loginSuccess } from '@/store/authSlice';
import { loginWithCredentials, getEmployees, setAuthToken } from '@/services/api';
import { signInWithMicrosoft } from '@/services/microsoftAuth';

const LoginScreen: React.FC<any> = ({ navigation }) => {
  const t = useTheme();
  const dispatch = useAppDispatch();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);

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
      // Map backend roles (Admin, HR, Manager, Employee) to navigator roles
      const rawRole = data.user.role || 'Employee';
      const mappedRole = ['Admin', 'HR'].includes(rawRole) ? 'hr'
        : rawRole === 'Manager' ? 'manager'
        : 'employee';

      // Fetch the Employee record's DB UUID (needed for attendance endpoints)
      // loginWithCredentials already stored the token in AsyncStorage, so getEmployees() will be authenticated
      let employeeDbId: string | null = null;
      try {
        await setAuthToken(data.accessToken);
        const empData = await getEmployees({ limit: 1 });
        employeeDbId = empData.data?.[0]?.id ?? null;
      } catch {
        // Not critical — screens will fall back to fetching it themselves
      }

      dispatch(loginSuccess({
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: mappedRole as any,
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
        employeeDbId,
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

  const onMicrosoftLogin = async () => {
    setMsLoading(true);
    setErrors({});
    try {
      const data = await signInWithMicrosoft();
      const rawRoleMs = data.user.role || 'Employee';
      const mappedRoleMs = ['Admin', 'HR'].includes(rawRoleMs) ? 'hr'
        : rawRoleMs === 'Manager' ? 'manager'
        : 'employee';
      let employeeDbIdMs: string | null = null;
      try {
        await setAuthToken(data.accessToken);
        const empDataMs = await getEmployees({ limit: 1 });
        employeeDbIdMs = empDataMs.data?.[0]?.id ?? null;
      } catch { /* not critical */ }
      dispatch(loginSuccess({
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: mappedRoleMs as any,
          empCode: data.user.id,
          phone: '',
          department: data.user.department || '',
          designation: '',
          joinedOn: '',
          active: true,
          workMode: 'WFO',
          avatar: '',
          shift: 'Flexible' as any,
        },
        token: data.accessToken,
        employeeDbId: employeeDbIdMs,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Microsoft sign-in failed';
      if (!message.toLowerCase().includes('cancelled')) {
        Alert.alert('Microsoft sign-in failed', message);
      }
    } finally {
      setMsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>

        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 24, backgroundColor: palette.primary,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: palette.primary, shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
          }}>
            {/* F letter mark for Foetron */}
            <Text style={{ fontSize: 38, fontWeight: '900', color: '#fff', letterSpacing: -1 }}>F</Text>
          </View>
          <Text style={{ fontSize: 26, fontWeight: '900', color: t.colors.text, marginTop: 14, letterSpacing: 0.5 }}>
            Foetron HRMS
          </Text>
          <Text style={{ color: t.colors.textMuted, marginTop: 4, fontSize: 13 }}>Workforce on your fingertips</Text>
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

        {/* ── OR divider ──────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 18 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
          <Text style={{ marginHorizontal: 12, color: t.colors.textMuted, fontSize: 12, fontWeight: '600' }}>OR</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
        </View>

        {/* ── Microsoft sign-in button ────────────────────────────── */}
        <Pressable
          onPress={onMicrosoftLogin}
          disabled={msLoading || loading}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: pressed ? t.colors.surfaceAlt : t.colors.surface,
            opacity: msLoading || loading ? 0.6 : 1,
          })}
        >
          {/* Microsoft 4-square logo (View-based) */}
          <View style={{ width: 18, height: 18, marginRight: 10 }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 8, height: 8, backgroundColor: '#F25022', marginRight: 2, marginBottom: 2 }} />
              <View style={{ width: 8, height: 8, backgroundColor: '#7FBA00', marginBottom: 2 }} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 8, height: 8, backgroundColor: '#00A4EF', marginRight: 2 }} />
              <View style={{ width: 8, height: 8, backgroundColor: '#FFB900' }} />
            </View>
          </View>
          <Text style={{ color: t.colors.text, fontSize: 15, fontWeight: '600' }}>
            {msLoading ? 'Connecting to Microsoft…' : 'Sign in with Microsoft'}
          </Text>
        </Pressable>

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
