import { useColorScheme } from 'react-native';

export const palette = {
  primary: '#1A3C6E',
  primaryDark: '#0F2747',
  primaryLight: '#2E5A9E',
  accent: '#F59E0B',
  present: '#16A34A',
  absent: '#DC2626',
  wfh: '#2563EB',
  leave: '#F59E0B',
  holiday: '#9CA3AF',
  weekend: '#E5E7EB',
  pending: '#6B7280',
};

export interface Theme {
  mode: 'light' | 'dark';
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryContrast: string;
    danger: string;
    success: string;
    warning: string;
    info: string;
    shadow: string;
    inputBg: string;
  };
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    background: '#F5F7FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F0F3F8',
    border: '#E5E7EB',
    text: '#0F172A',
    textMuted: '#64748B',
    primary: palette.primary,
    primaryContrast: '#FFFFFF',
    danger: palette.absent,
    success: palette.present,
    warning: palette.leave,
    info: palette.wfh,
    shadow: 'rgba(15, 23, 42, 0.08)',
    inputBg: '#FFFFFF',
  },
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    background: '#0B1220',
    surface: '#111B2E',
    surfaceAlt: '#17233B',
    border: '#1F2E49',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    primary: '#3B6FB8',
    primaryContrast: '#FFFFFF',
    danger: '#F87171',
    success: '#4ADE80',
    warning: '#FBBF24',
    info: '#60A5FA',
    shadow: 'rgba(0, 0, 0, 0.4)',
    inputBg: '#17233B',
  },
};

export const useTheme = (): Theme => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
};

export const statusColor = (status: string, t: Theme) => {
  switch (status) {
    case 'Present':
      return palette.present;
    case 'Absent':
      return palette.absent;
    case 'WFH':
      return palette.wfh;
    case 'Leave':
      return palette.leave;
    case 'Holiday':
      return palette.holiday;
    case 'Weekend':
      return t.mode === 'dark' ? '#334155' : palette.weekend;
    case 'Approved':
      return palette.present;
    case 'Rejected':
      return palette.absent;
    case 'Pending':
      return palette.pending;
    default:
      return t.colors.textMuted;
  }
};
