import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme, statusColor, palette } from '@/theme';

export const Screen: React.FC<{ children: React.ReactNode; padded?: boolean; style?: ViewStyle }> = ({
  children,
  padded = true,
  style,
}) => {
  const t = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: t.colors.background }, padded && { padding: 16 }, style]}>
      {children}
    </View>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.surface,
          borderRadius: 14,
          padding: 16,
          shadowColor: t.colors.shadow,
          shadowOpacity: 1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
          borderWidth: t.mode === 'dark' ? 1 : 0,
          borderColor: t.colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const Badge: React.FC<{ label: string; color?: string; style?: ViewStyle }> = ({ label, color, style }) => {
  const t = useTheme();
  const c = color ?? statusColor(label, t);
  return (
    <View
      style={[
        { backgroundColor: c + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
        style,
      ]}
    >
      <Text style={{ color: c, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </View>
  );
};

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  icon,
}) => {
  const t = useTheme();
  const bg =
    variant === 'primary'
      ? t.colors.primary
      : variant === 'danger'
      ? t.colors.danger
      : variant === 'secondary'
      ? t.colors.surfaceAlt
      : 'transparent';
  const fg =
    variant === 'secondary'
      ? t.colors.text
      : variant === 'ghost'
      ? t.colors.primary
      : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: t.colors.primary,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
};

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad';
  error?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

import { TextInput } from 'react-native';
export const Input: React.FC<InputProps> = ({ label, error, multiline, ...rest }) => {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={{ color: t.colors.textMuted, marginBottom: 6, fontSize: 13 }}>{label}</Text>}
      <TextInput
        {...rest}
        placeholderTextColor={t.colors.textMuted}
        multiline={multiline}
        style={{
          backgroundColor: t.colors.inputBg,
          borderWidth: 1,
          borderColor: error ? t.colors.danger : t.colors.border,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 12,
          color: t.colors.text,
          fontSize: 15,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error && <Text style={{ color: t.colors.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
};

export const SectionHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: t.colors.text }}>{title}</Text>
      {action}
    </View>
  );
};

export const EmptyState: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 32 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: t.colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 28 }}>📭</Text>
      </View>
      <Text style={{ color: t.colors.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
      {subtitle && <Text style={{ color: t.colors.textMuted, marginTop: 4, textAlign: 'center' }}>{subtitle}</Text>}
    </View>
  );
};

export const Skeleton: React.FC<{ height?: number; width?: number | string; style?: ViewStyle }> = ({
  height = 16,
  width = '100%',
  style,
}) => {
  const t = useTheme();
  return (
    <View
      style={[
        { height, width: width as any, backgroundColor: t.colors.surfaceAlt, borderRadius: 6, marginVertical: 4 },
        style,
      ]}
    />
  );
};

export const Divider: React.FC = () => {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 12 }} />;
};

export const Row: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>
);

export const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 40 }) => {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
};

export const styles = StyleSheet.create({});
