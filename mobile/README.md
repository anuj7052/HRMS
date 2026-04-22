# SmartHRMS — React Native Mobile App

Full-featured HRMS mobile app for Android & iOS built with **Expo + React Native + TypeScript**, **Redux Toolkit**, and **React Navigation**. Covers ESSL biometric-aware attendance, policy-driven work modes (WFO / WFH / Hybrid), leave management, correction workflow, manager & HR panels, announcements, holiday master and analytics — with realistic mock data and dark-mode support.

## Quick start

```bash
cd mobile
npm install
npx expo start            # press i for iOS, a for Android, or scan QR with Expo Go
```

## Demo credentials

On the login screen, pick any role chip (**Employee / Manager / HR**) and tap **Login**. Password / OTP flows are mocked. You can also switch role from **Profile → Demo · Switch role**.

| Role       | Who               | What they see                                                 |
| ---------- | ----------------- | ------------------------------------------------------------- |
| Employee   | Aarav Sharma      | Bottom tabs: Home, Attendance, Leaves, Profile                |
| Manager    | Neha Kapoor       | Bottom tabs: Team, Approvals, Calendar, Profile               |
| HR / Admin | Sanjay Mehta      | Drawer: Employees, Reports, Policies, Holidays, Announcements |

## Feature checklist

- **Auth** — Login (Emp ID / Email / OTP), OTP verify, Forgot password, JWT mock, Role switch.
- **Employee** — Dashboard with today-status card, work-mode badge, check-in/out, quick stats, recent attendance, shortcuts; Attendance log with filters; Monthly calendar (color-coded); WFH request (policy-aware quotas); Apply Leave + Leave balance (progress bars); Correction request; Notifications (filters + mark read); Profile.
- **Work Mode Engine** — WFO punches via ESSL only (app check-in hidden). WFH checks in via app. Hybrid unlocks app check-in only when an approved WFH exists for today, else prompts to use ESSL device.
- **Manager** — Team dashboard (live status, attendance %, pending count), Pending approvals (WFH + Leave with comments), Team calendar (14-day heat map per member), Team member detail (snapshot + escalate).
- **HR / Admin** — Employee list (search + work-mode filter), Add/Edit/Deactivate employee with role / work mode / shift, Policy settings (global / department / employee scoped, WFH quota, grace period, shift), Attendance reports (daily/weekly/monthly + department filter + bar charts + dept-wise % + CSV export), Announcements broadcast, Holiday master, Pending approvals with HR override.
- **Shared** — Settings (notification prefs per category + appearance), Help & Support (FAQ + mail/call), Change Password (strong-password rules).
- **UI/UX** — Deep-blue primary `#1A3C6E`, color-coded status (green/red/blue/yellow/grey), colored badge pills, cards with shadows, empty states, skeletons, loading/validation, dark mode via system.

## Folder structure

```
mobile/
├─ App.tsx
├─ app.json / babel.config.js / tsconfig.json / package.json
└─ src/
   ├─ components/UI.tsx          # Button, Input, Card, Badge, Avatar, EmptyState, Skeleton
   ├─ mock/data.ts               # Users, attendance, leaves, WFH, holidays, policies, notifications
   ├─ navigation/RootNavigator.tsx  # Role-based navigators (tabs / drawer / stacks)
   ├─ screens/
   │  ├─ auth/                   # Login, OTPVerify, ForgotPassword
   │  ├─ employee/               # Dashboard, AttendanceLog, MonthlyCalendar, WFHRequest,
   │  │                          #   LeaveApply, LeaveBalance, Notifications, Profile, Correction
   │  ├─ manager/                # TeamDashboard, PendingApprovals, TeamCalendar, TeamMemberDetail
   │  ├─ hr/                     # EmployeeList, EditEmployee, PolicySettings, AttendanceReports,
   │  │                          #   Announcements, HolidayMaster
   │  └─ shared/                 # Settings, HelpSupport, ChangePassword
   ├─ store/                     # Redux Toolkit: authSlice, dataSlice, typed hooks
   ├─ theme/                     # Light/dark themes, status colors, palette
   └─ types/                     # Domain types
```

## Wiring to the real backend (Express/Postgres in /backend)

Replace the mock-driven reducers in `src/store/dataSlice.ts` with RTK Query or `createAsyncThunk` calls to:

- `POST /api/auth/login`, `/auth/otp`, `/auth/forgot` (already present in `backend/src/routes/auth.ts`)
- `GET/POST /api/attendance`, `/api/attendance/correction`
- `GET/POST /api/leaves`, `PATCH /api/leaves/:id` for approvals
- `GET/POST /api/wfh`, `PATCH /api/wfh/:id`
- `GET /api/employees`, `POST/PATCH /api/employees/:id` for HR
- `GET /api/policies`, `PUT /api/policies/:id`
- `GET /api/holidays`, `POST /api/holidays`
- `GET /api/notifications`, `POST /api/announcements`
- `GET /api/iclock/*` — ESSL biometric sync endpoints (15-min cron in `services/cronService.ts` + `esslService.ts`).

Push notifications can be added with Expo Notifications (FCM / APNs) and toggled per-category through the existing `notificationPrefs` state.

## Accessibility & polish

- Minimum body font size ≥ 14; titles use 17–26.
- Status badges use label + color (not color-only).
- Light & dark themes, 44×44 tap targets, `Switch`es use brand color track.
- Validation errors shown under each input; Alerts confirm destructive actions (deactivate employee, remove holiday).
