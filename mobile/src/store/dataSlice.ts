import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  AppNotification,
  AttendanceRecord,
  CorrectionRequest,
  ESSLDevice,
  Holiday,
  LeaveBalance,
  LeaveRequest,
  Policy,
  RequestStatus,
  Shift,
  User,
  WFHRequest,
} from '@/types';
import {
  mockAttendance,
  mockCorrections,
  mockDevices,
  mockHolidays,
  mockLeaveBalances,
  mockLeaves,
  mockNotifications,
  mockPolicies,
  mockShifts,
  mockWFHRequests,
} from '@/mock/data';

interface DataState {
  employees: User[];
  attendance: AttendanceRecord[];
  wfhRequests: WFHRequest[];
  leaves: LeaveRequest[];
  leaveBalances: LeaveBalance[];
  corrections: CorrectionRequest[];
  notifications: AppNotification[];
  holidays: Holiday[];
  policies: Policy[];
  shifts: Shift[];
  devices: ESSLDevice[];
  notificationPrefs: Record<string, boolean>;
  /** HR-controlled: whether employees can check in/out via app */
  appCheckInEnabled: boolean;
}

const initialState: DataState = {
  employees: [],
  attendance: mockAttendance,
  wfhRequests: mockWFHRequests,
  leaves: mockLeaves,
  leaveBalances: mockLeaveBalances,
  corrections: mockCorrections,
  notifications: mockNotifications,
  holidays: mockHolidays,
  policies: mockPolicies,
  shifts: mockShifts,
  devices: mockDevices,
  notificationPrefs: {
    wfh: true,
    leave: true,
    attendance: true,
    correction: true,
    announcement: true,
  },
  appCheckInEnabled: true,
};

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    checkIn(
      state,
      action: PayloadAction<{
        userId: string;
        time: string;
        source: 'App' | 'ESSL';
        location?: { lat: number; lng: number; address?: string };
        selfieUri?: string;
      }>
    ) {
      const { userId, time, source, location, selfieUri } = action.payload;
      const today = new Date().toISOString().split('T')[0];
      // Determine the correct status based on the employee's workMode
      const emp = state.employees.find((e) => e.id === userId);
      const appStatus = emp?.workMode === 'WFH' ? 'WFH' : 'Present';
      const newStatus = source === 'App' ? appStatus : 'Present';

      const existing = state.attendance.find((a) => a.userId === userId && a.date === today);
      if (existing) {
        existing.checkIn = time;
        existing.status = newStatus;   // ← always refresh status
        existing.source = source;
        existing.location = location ?? existing.location;
        existing.selfieUri = selfieUri ?? existing.selfieUri;
      } else {
        state.attendance.unshift({
          id: `a-${Date.now()}`,
          userId,
          date: today,
          checkIn: time,
          status: newStatus,
          source,
          location,
          selfieUri,
        });
      }
    },
    checkOut(state, action: PayloadAction<{ userId: string; time: string }>) {
      const today = new Date().toISOString().split('T')[0];
      const rec = state.attendance.find((a) => a.userId === action.payload.userId && a.date === today);
      if (rec) {
        rec.checkOut = action.payload.time;
        // Keep WFH status for WFH employees; otherwise mark Present
        if (rec.status === 'Absent' || !rec.status) rec.status = 'Present';
        if (rec.checkIn) {
          const [h1, m1] = rec.checkIn.split(':').map(Number);
          const [h2, m2] = action.payload.time.split(':').map(Number);
          rec.workingHours = Math.max(0, h2 + m2 / 60 - (h1 + m1 / 60));
        }
      }
    },
    bulkIngestPunches(
      state,
      action: PayloadAction<
        Array<{ empCode: string; timestamp: string; direction: 'in' | 'out' }>
      >
    ) {
      const empByCode = new Map(state.employees.map((e) => [e.empCode.toUpperCase(), e.id]));
      // Sort ascending so first punch = earliest (checkIn), last = latest (checkOut).
      const sorted = [...action.payload].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // --- Build a per-employee+date map of (firstTime, lastTime) ---
      // We do this in a single pass so we always get the true first & last
      // punch regardless of what `direction` the report reports (the
      // eTimeTrackLite Excel export marks ALL punches as 'in').
      const dayMap = new Map<string, { first: string; last: string; count: number }>();
      for (const p of sorted) {
        const userId = empByCode.get(String(p.empCode).toUpperCase());
        if (!userId) continue;
        const [date, fullTime] = p.timestamp.split(' ');
        if (!date || !fullTime) continue;
        const time = fullTime.slice(0, 5); // HH:mm
        const key = `${userId}|${date}`;
        const existing = dayMap.get(key);
        if (!existing) {
          dayMap.set(key, { first: time, last: time, count: 1 });
        } else {
          if (time < existing.first) existing.first = time;
          if (time > existing.last) existing.last = time;
          existing.count++;
        }
      }

      // --- Write each unique employee+date into the attendance array ---
      for (const [key, { first, last, count }] of dayMap) {
        const [userId, date] = key.split('|');
        let rec = state.attendance.find((a) => a.userId === userId && a.date === date);
        if (!rec) {
          rec = {
            id: `essl-${userId}-${date}`,
            userId,
            date,
            status: 'Present',
            source: 'ESSL',
          };
          state.attendance.unshift(rec);
        }
        // Always overwrite with biometric truth: first = checkIn, last = checkOut.
        // Only set checkOut when there are ≥2 punches (otherwise person might not have left).
        rec.checkIn = first;
        rec.checkOut = count >= 2 ? last : undefined;
        rec.status = 'Present';
        rec.source = 'ESSL';
        if (rec.checkIn && rec.checkOut) {
          const [h1, m1] = rec.checkIn.split(':').map(Number);
          const [h2, m2] = rec.checkOut.split(':').map(Number);
          rec.workingHours = Math.max(0, h2 + m2 / 60 - (h1 + m1 / 60));
          // Late if check-in after 09:30
          const inMins = h1 * 60 + m1;
          rec.late = inMins > 9 * 60 + 30;
          // Early departure if checkout before 18:00
          const outMins = h2 * 60 + m2;
          rec.earlyDeparture = outMins < 18 * 60;
          // Overtime if worked > 9 hours
          rec.overtime = rec.workingHours > 9;
        }
      }
    },
    addWFHRequest(state, action: PayloadAction<WFHRequest>) {
      state.wfhRequests.unshift(action.payload);
    },
    updateWFHStatus(
      state,
      action: PayloadAction<{ id: string; status: RequestStatus; comment?: string; hrOverride?: boolean }>
    ) {
      const r = state.wfhRequests.find((x) => x.id === action.payload.id);
      if (r) {
        r.status = action.payload.status;
        r.managerComment = action.payload.comment ?? r.managerComment;
        r.hrOverride = action.payload.hrOverride;
      }
    },
    addLeave(state, action: PayloadAction<LeaveRequest>) {
      state.leaves.unshift(action.payload);
    },
    updateLeaveStatus(
      state,
      action: PayloadAction<{ id: string; status: RequestStatus; comment?: string }>
    ) {
      const r = state.leaves.find((x) => x.id === action.payload.id);
      if (r) {
        const prev = r.status;
        r.status = action.payload.status;
        r.approverComment = action.payload.comment ?? r.approverComment;
        // Keep leaveBalances in sync with approval decisions
        const bal = state.leaveBalances.find((b) => b.type === r.type);
        if (bal) {
          if (action.payload.status === 'Approved' && prev !== 'Approved') {
            bal.used = Math.min(bal.total, bal.used + r.days);
            bal.available = Math.max(0, bal.available - r.days);
          } else if (prev === 'Approved' && action.payload.status !== 'Approved') {
            bal.used = Math.max(0, bal.used - r.days);
            bal.available = Math.min(bal.total, bal.available + r.days);
          }
        }
      }
    },
    addCorrection(state, action: PayloadAction<CorrectionRequest>) {
      state.corrections.unshift(action.payload);
    },
    updateCorrectionStatus(
      state,
      action: PayloadAction<{ id: string; status: RequestStatus }>
    ) {
      const r = state.corrections.find((x) => x.id === action.payload.id);
      if (r) r.status = action.payload.status;
    },
    markNotificationRead(state, action: PayloadAction<string>) {
      const n = state.notifications.find((x) => x.id === action.payload);
      if (n) n.read = true;
    },
    markAllNotificationsRead(state) {
      state.notifications.forEach((n) => (n.read = true));
    },
    addNotification(state, action: PayloadAction<AppNotification>) {
      state.notifications.unshift(action.payload);
    },
    toggleNotificationPref(state, action: PayloadAction<string>) {
      state.notificationPrefs[action.payload] = !state.notificationPrefs[action.payload];
    },
    addEmployee(state, action: PayloadAction<User>) {
      state.employees.push(action.payload);
    },
    updateEmployee(state, action: PayloadAction<User>) {
      const i = state.employees.findIndex((e) => e.id === action.payload.id);
      if (i >= 0) state.employees[i] = action.payload;
    },
    deactivateEmployee(state, action: PayloadAction<string>) {
      const e = state.employees.find((x) => x.id === action.payload);
      if (e) e.active = false;
    },
    addHoliday(state, action: PayloadAction<Holiday>) {
      state.holidays.push(action.payload);
    },
    removeHoliday(state, action: PayloadAction<string>) {
      state.holidays = state.holidays.filter((h) => h.id !== action.payload);
    },
    upsertPolicy(state, action: PayloadAction<Policy>) {
      const i = state.policies.findIndex((p) => p.id === action.payload.id);
      if (i >= 0) state.policies[i] = action.payload;
      else state.policies.push(action.payload);
    },
    upsertShift(state, action: PayloadAction<Shift>) {
      const i = state.shifts.findIndex((s) => s.id === action.payload.id);
      if (i >= 0) state.shifts[i] = action.payload;
      else state.shifts.push(action.payload);
    },
    removeShift(state, action: PayloadAction<string>) {
      state.shifts = state.shifts.filter((s) => s.id !== action.payload);
    },
    syncDevice(state, action: PayloadAction<string>) {
      const d = state.devices.find((x) => x.id === action.payload);
      if (d) {
        d.lastSync = new Date().toISOString();
        d.status = 'online';
        d.punchCountToday += Math.floor(Math.random() * 5);
      }
    },
    syncAllDevices(state) {
      state.devices.forEach((d) => {
        d.lastSync = new Date().toISOString();
        if (d.status !== 'error') d.status = 'online';
      });
    },
    setAppCheckInEnabled(state, action: PayloadAction<boolean>) {
      state.appCheckInEnabled = action.payload;
    },
  },
});

export const {
  checkIn,
  checkOut,
  bulkIngestPunches,
  addWFHRequest,
  updateWFHStatus,
  addLeave,
  updateLeaveStatus,
  addCorrection,
  updateCorrectionStatus,
  markNotificationRead,
  markAllNotificationsRead,
  addNotification,
  toggleNotificationPref,
  addEmployee,
  updateEmployee,
  deactivateEmployee,
  addHoliday,
  removeHoliday,
  upsertPolicy,
  upsertShift,
  removeShift,
  syncDevice,
  syncAllDevices,
  setAppCheckInEnabled,
} = dataSlice.actions;

export default dataSlice.reducer;
