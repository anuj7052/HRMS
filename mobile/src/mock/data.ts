import {
  AppNotification,
  AttendanceRecord,
  CorrectionRequest,
  ESSLDevice,
  Holiday,
  LeaveBalance,
  LeaveRequest,
  Policy,
  Shift,
  User,
  WFHRequest,
} from '@/types';
import { importedUsers } from './importedUsers';

const today = new Date();
const iso = (d: Date) => d.toISOString().split('T')[0];
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return iso(d);
};

export const mockUsers: User[] = [
  {
    id: 'admin',
    empCode: 'ADMIN',
    name: 'Admin',
    email: 'admin@admin.com',
    phone: '+91 00000 00000',
    role: 'hr',
    jobRole: 'Admin',
    workMode: 'WFO',
    department: 'Administration',
    designation: 'Administrator',
    shift: 'Morning',
    active: true,
    joinedOn: '2024-01-01',
  },
  {
    id: 'user',
    empCode: 'USER',
    name: 'User',
    email: 'user',
    phone: '+91 00000 00001',
    role: 'employee',
    jobRole: 'Executive',
    workMode: 'WFH',
    department: 'General',
    designation: 'Employee',
    shift: 'Morning',
    active: true,
    joinedOn: '2024-01-01',
  },
  {
    id: 'director',
    empCode: 'DIR001',
    name: 'Ravi Director',
    email: 'director',
    phone: '+91 00000 00002',
    role: 'hr',
    jobRole: 'Director',
    workMode: 'WFO',
    department: 'Management',
    designation: 'Director',
    shift: 'Morning',
    active: true,
    joinedOn: '2020-01-01',
  },
  {
    id: 'manager',
    empCode: 'MGR001',
    name: 'Neha Manager',
    email: 'manager',
    phone: '+91 00000 00003',
    role: 'manager',
    jobRole: 'Manager',
    workMode: 'WFO',
    department: 'Engineering',
    designation: 'Team Lead',
    shift: 'Morning',
    active: true,
    joinedOn: '2022-01-01',
  },
  ...importedUsers.map((u) => ({ ...u, managerId: u.managerId ?? 'admin' })),
];

export const mockAttendance: AttendanceRecord[] = [];

export const mockWFHRequests: WFHRequest[] = [];

export const mockLeaves: LeaveRequest[] = [];

export const mockLeaveBalances: LeaveBalance[] = [
  { type: 'Sick', total: 12, used: 3, available: 9 },
  { type: 'Casual', total: 10, used: 4, available: 6 },
  { type: 'Paid', total: 18, used: 6, available: 12 },
  { type: 'CompOff', total: 4, used: 1, available: 3 },
  { type: 'Optional', total: 2, used: 0, available: 2 },
];

export const mockCorrections: CorrectionRequest[] = [];

export const mockNotifications: AppNotification[] = [];

export const mockHolidays: Holiday[] = [
  { id: 'h1', date: `${today.getFullYear()}-01-26`, name: 'Republic Day' },
  { id: 'h2', date: `${today.getFullYear()}-08-15`, name: 'Independence Day' },
  { id: 'h3', date: `${today.getFullYear()}-10-02`, name: 'Gandhi Jayanti' },
  { id: 'h4', date: `${today.getFullYear()}-11-12`, name: 'Diwali', optional: true },
  { id: 'h5', date: `${today.getFullYear()}-12-25`, name: 'Christmas' },
];

export const mockPolicies: Policy[] = [
  {
    id: 'p1',
    scope: 'global',
    maxWfhPerMonth: 8,
    gracePeriodMins: 15,
    shiftStart: '09:30',
    shiftEnd: '18:30',
  },
  {
    id: 'p2',
    scope: 'department',
    target: 'Engineering',
    maxWfhPerMonth: 12,
    gracePeriodMins: 20,
    shiftStart: '10:00',
    shiftEnd: '19:00',
  },
];

export const mockShifts: Shift[] = [
  { id: 's1', name: 'Morning Shift', type: 'Morning', startTime: '09:30', endTime: '18:30', graceMinutes: 15, assignedCount: 32 },
  { id: 's2', name: 'Evening Shift', type: 'Evening', startTime: '14:00', endTime: '23:00', graceMinutes: 10, assignedCount: 8 },
  { id: 's3', name: 'Night Shift', type: 'Night', startTime: '22:00', endTime: '07:00', graceMinutes: 10, assignedCount: 4 },
  { id: 's4', name: 'Flexible', type: 'Flexible', startTime: '10:00', endTime: '19:00', graceMinutes: 60, assignedCount: 12 },
];

export const mockDevices: ESSLDevice[] = [
  {
    id: 'd1',
    name: 'Biometric',
    serial: 'CGKK220762223',
    ip: '',
    location: 'Sec49',
    lastSync: '2026-04-20T11:51:00.000Z',
    status: 'online',
    punchCountToday: 0,
  },
];
