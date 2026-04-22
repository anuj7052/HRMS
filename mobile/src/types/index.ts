export type Role = 'employee' | 'manager' | 'hr';
export type WorkMode = 'WFO' | 'WFH' | 'Hybrid';
export type AttendanceStatus = 'Present' | 'Absent' | 'WFH' | 'Leave' | 'Holiday' | 'Weekend';
export type RequestStatus = 'Pending' | 'Approved' | 'Rejected';
export type LeaveType = 'Sick' | 'Casual' | 'Paid' | 'CompOff' | 'Optional';
export type ShiftType = 'Morning' | 'Evening' | 'Night' | 'Flexible';

// ─── Job Roles ────────────────────────────────────────────────────────────────
// These are the selectable job roles when creating / editing an employee.
// jobRoleToSystemRole() auto-maps each to the system Role that drives navigation.
export type JobRole =
  // Leadership / C-Suite → hr navigator (full access)
  | 'CEO'
  | 'Director'
  | 'COO'
  // HR team → hr navigator
  | 'HR Manager'
  | 'HR Executive'
  | 'Admin'
  // Management → manager navigator
  | 'Manager'
  | 'Team Lead'
  | 'Department Head'
  | 'Senior Manager'
  // Individual contributors → employee navigator
  | 'Senior Executive'
  | 'Executive'
  | 'Senior Engineer'
  | 'Engineer'
  | 'Analyst'
  | 'Consultant'
  | 'Cloud Support Engineer'
  | 'Member'
  | 'Intern'
  | 'Other';

/** Maps a JobRole to the system Role that controls which navigator is shown. */
export function jobRoleToSystemRole(jobRole: JobRole): Role {
  const hrAccess: JobRole[] = ['CEO', 'Director', 'COO', 'HR Manager', 'HR Executive', 'Admin'];
  const managerAccess: JobRole[] = ['Manager', 'Team Lead', 'Department Head', 'Senior Manager'];
  if (hrAccess.includes(jobRole)) return 'hr';
  if (managerAccess.includes(jobRole)) return 'manager';
  return 'employee';
}

/** Human-readable category label for a job role */
export const JOB_ROLE_GROUPS: { label: string; roles: JobRole[] }[] = [
  { label: 'Leadership', roles: ['CEO', 'Director', 'COO'] },
  { label: 'HR & Admin', roles: ['HR Manager', 'HR Executive', 'Admin'] },
  { label: 'Management', roles: ['Manager', 'Team Lead', 'Senior Manager', 'Department Head'] },
  {
    label: 'Individual Contributor',
    roles: ['Senior Executive', 'Executive', 'Senior Engineer', 'Engineer',
            'Analyst', 'Consultant', 'Cloud Support Engineer', 'Member', 'Intern', 'Other'],
  },
];

export interface User {
  id: string;
  empCode: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  jobRole?: JobRole;     // structured picklist — drives role auto-assignment
  workMode: WorkMode;
  department: string;
  designation: string;   // free-text display title (e.g. "Senior Software Engineer")
  managerId?: string;
  shift: ShiftType;
  avatar?: string;
  active: boolean;
  joinedOn: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // HH:mm
  checkOut?: string;
  workingHours?: number;
  status: AttendanceStatus;
  source: 'ESSL' | 'App' | 'Manual';
  late?: boolean;
  earlyDeparture?: boolean;
  overtime?: boolean;
  location?: { lat: number; lng: number; address?: string };
  selfieUri?: string;
}

export interface WFHRequest {
  id: string;
  userId: string;
  userName: string;
  dates: string[];
  reason: string;
  status: RequestStatus;
  managerComment?: string;
  hrOverride?: boolean;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  documentUri?: string;
  status: RequestStatus;
  approverComment?: string;
  createdAt: string;
}

export interface LeaveBalance {
  type: LeaveType;
  total: number;
  used: number;
  available: number;
}

export interface CorrectionRequest {
  id: string;
  userId: string;
  date: string;
  reason: string;
  detail: string;
  status: RequestStatus;
  documentUri?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  category: 'wfh' | 'leave' | 'attendance' | 'correction' | 'announcement';
  read: boolean;
  createdAt: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  optional?: boolean;
}

export interface Policy {
  id: string;
  scope: 'global' | 'department' | 'employee';
  target?: string;
  maxWfhPerMonth: number;
  gracePeriodMins: number;
  shiftStart: string;
  shiftEnd: string;
}

export interface Shift {
  id: string;
  name: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  assignedCount: number;
}

export interface ESSLDevice {
  id: string;
  name: string;
  serial: string;
  ip: string;
  location: string;
  lastSync: string;
  status: 'online' | 'offline' | 'error';
  punchCountToday: number;
}
