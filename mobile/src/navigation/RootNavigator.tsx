import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text, View, useColorScheme } from 'react-native';

import { useAppSelector } from '@/store';
import { palette, useTheme } from '@/theme';
import { jobRoleToSystemRole } from '@/types';

import LoginScreen from '@/screens/auth/LoginScreen';
import OTPVerifyScreen from '@/screens/auth/OTPVerifyScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';

import DashboardScreen from '@/screens/employee/DashboardScreen';
import AttendanceLogScreen from '@/screens/employee/AttendanceLogScreen';
import MonthlyCalendarScreen from '@/screens/employee/MonthlyCalendarScreen';
import WFHRequestScreen from '@/screens/employee/WFHRequestScreen';
import LeaveApplyScreen from '@/screens/employee/LeaveApplyScreen';
import LeaveBalanceScreen from '@/screens/employee/LeaveBalanceScreen';
import NotificationsScreen from '@/screens/employee/NotificationsScreen';
import ProfileScreen from '@/screens/employee/ProfileScreen';
import CorrectionRequestScreen from '@/screens/employee/CorrectionRequestScreen';
import CheckInScreen from '@/screens/employee/CheckInScreen';

import TeamDashboardScreen from '@/screens/manager/TeamDashboardScreen';
import PendingApprovalsScreen from '@/screens/manager/PendingApprovalsScreen';
import TeamCalendarScreen from '@/screens/manager/TeamCalendarScreen';
import TeamMemberDetailScreen from '@/screens/manager/TeamMemberDetailScreen';

import HRDashboardScreen from '@/screens/hr/HRDashboardScreen';
import HRMoreScreen from '@/screens/hr/HRMoreScreen';
import EmployeeListScreen from '@/screens/hr/EmployeeListScreen';
import EditEmployeeScreen from '@/screens/hr/EditEmployeeScreen';
import PolicySettingsScreen from '@/screens/hr/PolicySettingsScreen';
import AttendanceReportsScreen from '@/screens/hr/AttendanceReportsScreen';
import AnnouncementsScreen from '@/screens/hr/AnnouncementsScreen';
import HolidayMasterScreen from '@/screens/hr/HolidayMasterScreen';
import ShiftManagementScreen from '@/screens/hr/ShiftManagementScreen';
import DeviceSyncScreen from '@/screens/hr/DeviceSyncScreen';
import EsslConnectionScreen from '@/screens/hr/EsslConnectionScreen';
import HRAllAttendanceScreen from '@/screens/hr/HRAllAttendanceScreen';
import EmployeeAttendanceProfileScreen from '@/screens/hr/EmployeeAttendanceProfileScreen';
import SettingsScreen from '@/screens/shared/SettingsScreen';
import HelpSupportScreen from '@/screens/shared/HelpSupportScreen';
import ChangePasswordScreen from '@/screens/shared/ChangePasswordScreen';

const AuthStack = createNativeStackNavigator();
const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="OTPVerify" component={OTPVerifyScreen} />
    <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </AuthStack.Navigator>
);

// ---------- Employee ----------
const EmpTab = createBottomTabNavigator();
const EmpStack = createNativeStackNavigator();

const EmployeeHomeStack = () => (
  <EmpStack.Navigator screenOptions={{ headerShown: true }}>
    <EmpStack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'SmartHRMS' }} />
    <EmpStack.Screen name="Notifications" component={NotificationsScreen} />
    <EmpStack.Screen name="CheckIn" component={CheckInScreen} options={{ title: 'WFH Check-in' }} />
    <EmpStack.Screen name="CorrectionRequest" component={CorrectionRequestScreen} options={{ title: 'Correction Request' }} />
    <EmpStack.Screen name="Settings" component={SettingsScreen} />
    <EmpStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
    <EmpStack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ title: 'Help & Support' }} />
  </EmpStack.Navigator>
);

const EmployeeAttendanceStack = () => (
  <EmpStack.Navigator>
    <EmpStack.Screen name="AttendanceLog" component={AttendanceLogScreen} options={{ title: 'Attendance' }} />
    <EmpStack.Screen name="MonthlyCalendar" component={MonthlyCalendarScreen} options={{ title: 'Monthly View' }} />
    <EmpStack.Screen name="CorrectionRequest" component={CorrectionRequestScreen} options={{ title: 'Correction Request' }} />
  </EmpStack.Navigator>
);

const EmployeeLeaveStack = () => (
  <EmpStack.Navigator>
    <EmpStack.Screen name="LeaveBalance" component={LeaveBalanceScreen} options={{ title: 'Leaves' }} />
    <EmpStack.Screen name="LeaveApply" component={LeaveApplyScreen} options={{ title: 'Apply Leave' }} />
    <EmpStack.Screen name="WFHRequest" component={WFHRequestScreen} options={{ title: 'WFH Request' }} />
  </EmpStack.Navigator>
);

const EmployeeProfileStack = () => (
  <EmpStack.Navigator>
    <EmpStack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
    <EmpStack.Screen name="Settings" component={SettingsScreen} />
    <EmpStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
    <EmpStack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ title: 'Help & Support' }} />
  </EmpStack.Navigator>
);

const EmployeeNavigator = () => {
  const t = useTheme();
  return (
    <EmpTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopColor: t.colors.border, height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home-outline',
            Attendance: 'time-outline',
            Leaves: 'calendar-outline',
            Profile: 'person-outline',
          };
          return <Ionicons name={map[route.name] || 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <EmpTab.Screen name="Home" component={EmployeeHomeStack} />
      <EmpTab.Screen name="Attendance" component={EmployeeAttendanceStack} />
      <EmpTab.Screen name="Leaves" component={EmployeeLeaveStack} />
      <EmpTab.Screen name="Profile" component={EmployeeProfileStack} />
    </EmpTab.Navigator>
  );
};

// ---------- Manager ----------
const MgrStack = createNativeStackNavigator();
const MgrTab = createBottomTabNavigator();

const ManagerHomeStack = () => (
  <MgrStack.Navigator>
    <MgrStack.Screen name="TeamDashboard" component={TeamDashboardScreen} options={{ title: 'Team' }} />
    <MgrStack.Screen name="TeamMemberDetail" component={TeamMemberDetailScreen} options={{ title: 'Team Member' }} />
    <MgrStack.Screen name="Notifications" component={NotificationsScreen} />
  </MgrStack.Navigator>
);

// Manager Attendance — shows only manager's own team (HRAllAttendanceScreen is role-aware)
const ManagerAttendanceStack = () => (
  <MgrStack.Navigator>
    <MgrStack.Screen name="TeamAttendance" component={HRAllAttendanceScreen} options={{ title: 'Team Attendance' }} />
    <MgrStack.Screen name="EmployeeAttendanceProfile" component={EmployeeAttendanceProfileScreen} options={{ title: 'Profile' }} />
  </MgrStack.Navigator>
);

const ManagerProfileStack = () => (
  <MgrStack.Navigator>
    <MgrStack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
    <MgrStack.Screen name="Settings" component={SettingsScreen} />
    <MgrStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
    <MgrStack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ title: 'Help & Support' }} />
  </MgrStack.Navigator>
);

const ManagerNavigator = () => {
  const t = useTheme();
  return (
    <MgrTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopColor: t.colors.border, height: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            Team:       ['people', 'people-outline'],
            Attendance: ['time', 'time-outline'],
            Approvals:  ['checkmark-done-circle', 'checkmark-done-circle-outline'],
            Calendar:   ['calendar', 'calendar-outline'],
            Profile:    ['person', 'person-outline'],
          };
          const pair = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? pair[0] : pair[1]} size={size} color={color} />;
        },
      })}
    >
      <MgrTab.Screen name="Team" component={ManagerHomeStack} />
      <MgrTab.Screen name="Attendance" component={ManagerAttendanceStack} options={{ title: 'Attendance' }} />
      <MgrTab.Screen name="Approvals" component={PendingApprovalsScreen} />
      <MgrTab.Screen name="Calendar" component={TeamCalendarScreen} />
      <MgrTab.Screen name="Profile" component={ManagerProfileStack} />
    </MgrTab.Navigator>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HR – Bottom Tab Navigator (replaces old drawer)
// ─────────────────────────────────────────────────────────────────────────────
const HRStack = createNativeStackNavigator();
const HRTab   = createBottomTabNavigator();

// Tab 1 – Home: dashboard + deep-link targets for tile navigation
const HRHomeStack = () => (
  <HRStack.Navigator>
    <HRStack.Screen name="HRDashboard" component={HRDashboardScreen} options={{ headerShown: false }} />
    <HRStack.Screen name="Notifications" component={NotificationsScreen} />
    <HRStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    <HRStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
    <HRStack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ title: 'Help & Support' }} />
  </HRStack.Navigator>
);

// Tab 2 – Attendance
const HRAttendanceStack = () => (
  <HRStack.Navigator>
    <HRStack.Screen name="AllAttendanceList" component={HRAllAttendanceScreen} options={{ title: 'All Employee Attendance' }} />
    <HRStack.Screen name="EmployeeAttendanceProfile" component={EmployeeAttendanceProfileScreen} options={{ title: 'Profile' }} />
  </HRStack.Navigator>
);

// Tab 3 – Employees
const HREmployeesStack = () => (
  <HRStack.Navigator>
    <HRStack.Screen name="EmployeeList" component={EmployeeListScreen} options={{ title: 'Employees' }} />
    <HRStack.Screen name="EditEmployee" component={EditEmployeeScreen} options={{ title: 'Edit Employee' }} />
  </HRStack.Navigator>
);

// Tab 4 – Approvals
const HRApprovalsStack = () => (
  <HRStack.Navigator>
    <HRStack.Screen name="ApprovalsScreen" component={PendingApprovalsScreen} options={{ title: 'Approvals' }} />
  </HRStack.Navigator>
);

// Tab 5 – More (grid + all secondary modules)
const HRMoreStack = () => (
  <HRStack.Navigator>
    <HRStack.Screen name="MoreHome" component={HRMoreScreen} options={{ headerShown: false }} />
    <HRStack.Screen name="EsslConnection" component={EsslConnectionScreen} options={{ title: 'eSSL Live Sync' }} />
    <HRStack.Screen name="Reports" component={AttendanceReportsScreen} options={{ title: 'Attendance Reports' }} />
    <HRStack.Screen name="Devices" component={DeviceSyncScreen} options={{ title: 'Biometric Devices' }} />
    <HRStack.Screen name="ShiftMgmt" component={ShiftManagementScreen} options={{ title: 'Shift Management' }} />
    <HRStack.Screen name="Policies" component={PolicySettingsScreen} options={{ title: 'Policy Settings' }} />
    <HRStack.Screen name="Holidays" component={HolidayMasterScreen} options={{ title: 'Holiday Master' }} />
    <HRStack.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: 'Announcements' }} />
    <HRStack.Screen name="ApprovalsScreen" component={PendingApprovalsScreen} options={{ title: 'Approvals' }} />
    <HRStack.Screen name="Notifications" component={NotificationsScreen} />
    <HRStack.Screen name="SettingsMore" component={SettingsScreen} options={{ title: 'Settings' }} />
    <HRStack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
    <HRStack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ title: 'Help & Support' }} />
  </HRStack.Navigator>
);

const HRNavigator = () => {
  const t = useTheme();
  return (
    <HRTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            Home:       ['home', 'home-outline'],
            Attendance: ['people-circle', 'people-circle-outline'],
            Employees:  ['people', 'people-outline'],
            Approvals:  ['checkmark-done-circle', 'checkmark-done-circle-outline'],
            More:       ['grid', 'grid-outline'],
          };
          const pair = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? pair[0] : pair[1]} size={size} color={color} />;
        },
      })}
    >
      <HRTab.Screen name="Home" component={HRHomeStack} options={{ title: 'Home' }} />
      <HRTab.Screen name="Attendance" component={HRAttendanceStack} options={{ title: 'Attendance' }} />
      <HRTab.Screen name="Employees" component={HREmployeesStack} options={{ title: 'Employees' }} />
      <HRTab.Screen name="Approvals" component={HRApprovalsStack} options={{ title: 'Approvals' }} />
      <HRTab.Screen name="More" component={HRMoreStack} options={{ title: 'More' }} />
    </HRTab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const scheme = useColorScheme();
  const navTheme = scheme === 'dark'
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: palette.primary } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: palette.primary } };
  return (
    <NavigationContainer theme={navTheme}>
      {!user ? (
        <AuthNavigator />
      ) : (() => {
        // Job role is the source of truth if set; fall back to the stored role field
        const effectiveRole = user.jobRole ? jobRoleToSystemRole(user.jobRole) : user.role;
        // Database roles: Admin, HR → HR navigator (full access)
        // Database roles: Manager → Manager navigator
        // effectiveRole from jobRoleToSystemRole: 'hr' | 'manager' | 'employee'
        const isHR = effectiveRole === 'hr' || effectiveRole === 'HR' || effectiveRole === 'Admin';
        const isManager = effectiveRole === 'manager' || effectiveRole === 'Manager';
        if (isHR) return <HRNavigator />;
        if (isManager) return <ManagerNavigator />;
        return <EmployeeNavigator />;
      })()}
    </NavigationContainer>
  );
};
