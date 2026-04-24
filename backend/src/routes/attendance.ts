import { Router, Response } from 'express';
import { query, body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/auth';
import { fetchFromIClockServerDirect, decryptFromStorage } from '../services/etlService';
import { processAttendanceFromRaw } from '../services/esslService';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticateJWT);

// ─── POST /api/attendance/sync-live ─────────────────────────────────────────
// Admin/HR trigger: pulls live attendance from the eTimeTrackLite server for all autoSync devices
router.post('/sync-live', requireRole(['Admin', 'HR']), async (_req: AuthRequest, res: Response): Promise<void> => {
  const devices = await prisma.device.findMany({ where: { isActive: true } });
  if (devices.length === 0) {
    res.status(404).json({ message: 'No active devices found' }); return;
  }

  let totalNew = 0;
  const results: { device: string; logsImported: number; message: string }[] = [];

  for (const device of devices) {
    let password: string | undefined;
    if (device.etlPassword) {
      try { password = decryptFromStorage(device.etlPassword); } catch { /* ignore */ }
    }
    const baseUrl = `http://${device.ip}:${device.port}`;
    try {
      const result = await fetchFromIClockServerDirect(
        baseUrl,
        device.serialNumber,
        device.lastEtlSync ?? undefined,
        device.etlUsername ?? undefined,
        password,
      );

      const cutoff = device.lastEtlSync
        ? new Date(device.lastEtlSync.getTime() - 2 * 60 * 60 * 1000)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      let newLogs = 0;
      for (const record of result.records) {
        if (record.timestamp < cutoff) continue;
        try {
          await prisma.rawPunchLog.create({
            data: {
              deviceId: device.id,
              employeeDeviceId: record.employeeDeviceId,
              timestamp: record.timestamp,
              punchType: record.punchType,
              raw: record.raw,
            },
          });
          newLogs++;
        } catch { /* duplicate */ }
      }
      if (newLogs > 0) {
        await processAttendanceFromRaw(device.id);
        await prisma.device.update({ where: { id: device.id }, data: { lastEtlSync: new Date(), status: 'Online', lastSync: new Date(), lastError: null } });
      }
      totalNew += newLogs;
      results.push({ device: device.name, logsImported: newLogs, message: result.message });
    } catch (e) {
      results.push({ device: device.name, logsImported: 0, message: (e as Error).message });
    }
  }

  res.json({
    success: true,
    message: `Live sync complete. ${totalNew} new punch log(s) imported.`,
    totalLogsImported: totalNew,
    devices: results,
  });
});

// ─── GET /api/attendance/monthly-summary ────────────────────────────────────
router.get('/monthly-summary', requireRole(['Admin', 'HR']), async (req: AuthRequest, res: Response): Promise<void> => {
  const month = parseInt((req.query.month as string) || String(new Date().getMonth() + 1));
  const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: { user: { select: { name: true } } },
  });

  const allLogs = await prisma.attendanceLog.findMany({
    where: { date: { gte: start, lt: end } },
    select: { employeeId: true, status: true },
  });

  const logsByEmployee = new Map<string, typeof allLogs>();
  allLogs.forEach((log) => {
    if (!logsByEmployee.has(log.employeeId)) logsByEmployee.set(log.employeeId, []);
    logsByEmployee.get(log.employeeId)!.push(log);
  });

  const summary = employees.map((emp) => {
    const eLogs = logsByEmployee.get(emp.id) || [];
    const counts = { Present: 0, Late: 0, Absent: 0, Leave: 0, WeeklyOff: 0, Holiday: 0, HalfDay: 0 };
    eLogs.forEach((l) => { if (l.status in counts) counts[l.status as keyof typeof counts]++; });
    return {
      _id: emp.id,
      employeeId: emp.employeeId,
      name: emp.user?.name || 'Unknown',
      department: emp.department,
      ...counts,
      total: eLogs.length,
    };
  });

  res.json({ summary, month, year });
});

// ─── GET /api/attendance/today ──────────────────────────────────────────────
router.get('/today', requireRole(['Admin', 'HR']), async (_req, res: Response): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [present, absent, late, onLeave, totalEmployees] = await Promise.all([
    prisma.attendanceLog.count({ where: { date: { gte: today, lt: tomorrow }, status: 'Present' } }),
    prisma.attendanceLog.count({ where: { date: { gte: today, lt: tomorrow }, status: 'Absent' } }),
    prisma.attendanceLog.count({ where: { date: { gte: today, lt: tomorrow }, status: 'Late' } }),
    prisma.attendanceLog.count({ where: { date: { gte: today, lt: tomorrow }, status: 'Leave' } }),
    prisma.employee.count({ where: { isActive: true } }),
  ]);

  const recent = await prisma.attendanceLog.findMany({
    where: { date: { gte: today, lt: tomorrow } },
    include: {
      employee: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: { punchIn: 'desc' },
    take: 10,
  });

  res.json({ present, absent, late, onLeave, totalEmployees, recent });
});

// ─── GET /api/attendance/employee/:id ───────────────────────────────────────
router.get('/employee/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  // Employees can only view their own data
  if (req.user?.role === 'Employee') {
    const emp = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!emp || emp.id !== req.params.id) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }
  }

  const month = parseInt((req.query.month as string) || String(new Date().getMonth() + 1));
  const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const logs = await prisma.attendanceLog.findMany({
    where: { employeeId: req.params.id, date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  });

  res.json({ logs, month, year });
});

// ─── GET /api/attendance/regularizations ────────────────────────────────────
router.get('/regularizations', requireRole(['Admin', 'HR']), async (_req, res: Response): Promise<void> => {
  const pending = await prisma.attendanceLog.findMany({
    where: { regularizationStatus: 'Pending' },
    include: {
      employee: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { regularizationRequestedAt: 'desc' },
  });
  res.json(pending);
});

// ─── POST /api/attendance/regularize ────────────────────────────────────────
router.post(
  '/regularize',
  [
    body('attendanceId').notEmpty(),
    body('reason').trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { attendanceId, reason } = req.body as { attendanceId: string; reason: string };

    const log = await prisma.attendanceLog.findUnique({ where: { id: attendanceId } });
    if (!log) {
      res.status(404).json({ message: 'Attendance record not found' });
      return;
    }

    // Verify ownership if employee
    if (req.user?.role === 'Employee') {
      const emp = await prisma.employee.findFirst({ where: { userId: req.user.id } });
      if (!emp || emp.id !== log.employeeId) {
        res.status(403).json({ message: 'Insufficient permissions' });
        return;
      }
    }

    await prisma.attendanceLog.update({
      where: { id: attendanceId },
      data: {
        regularizationReason: reason,
        regularizationStatus: 'Pending',
        regularizationRequestedAt: new Date(),
      },
    });

    res.json({ message: 'Regularization request submitted' });
  }
);

// ─── PUT /api/attendance/regularizations/:id/review ─────────────────────────
router.put(
  '/regularizations/:id/review',
  requireRole(['Admin', 'HR']),
  [
    body('status').isIn(['Approved', 'Rejected']),
    body('comment').optional().isString(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const log = await prisma.attendanceLog.findUnique({ where: { id: req.params.id } });
    if (!log) {
      res.status(404).json({ message: 'Record not found' });
      return;
    }

    const { status, comment } = req.body as { status: 'Approved' | 'Rejected'; comment?: string };
    await prisma.attendanceLog.update({
      where: { id: req.params.id },
      data: {
        regularizationStatus: status,
        ...(status === 'Approved' ? { isRegularized: true, status: 'Present' } : {}),
        ...(comment ? { regularizationReason: comment } : {}),
      },
    });

    res.json({ message: `Regularization ${status}` });
  }
);

// ─── GET /api/attendance/today-status ────────────────────────────────────────
// Returns the current punch state for the authenticated employee
router.get('/today-status', async (req: AuthRequest, res: Response): Promise<void> => {
  const employee = await prisma.employee.findFirst({ where: { userId: req.user!.id } });
  if (!employee) {
    res.status(404).json({ message: 'Employee record not found' });
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const log = await prisma.attendanceLog.findFirst({
    where: { employeeId: employee.id, date: { gte: today, lt: tomorrow } },
  });

  let shiftStart = '09:00';
  if (employee.shiftId) {
    const shift = await prisma.shift.findUnique({ where: { id: employee.shiftId } });
    if (shift) shiftStart = shift.startTime;
  } else {
    const settings = await prisma.appSettings.findFirst();
    shiftStart = settings?.shiftStart || '09:00';
  }

  res.json({
    log: log || null,
    isPunchedIn: !!(log?.punchIn),
    isPunchedOut: !!(log?.punchOut),
    shiftStart,
    todayDate: today.toISOString(),
  });
});

// ─── POST /api/attendance/punch-in ────────────────────────────────────────────
router.post(
  '/punch-in',
  [
    body('lat').optional().isFloat({ min: -90, max: 90 }),
    body('lng').optional().isFloat({ min: -180, max: 180 }),
    body('attendanceMode').optional().isIn(['Office', 'WFH', 'Field', 'ClientVisit']),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const employee = await prisma.employee.findFirst({ where: { userId: req.user!.id } });
    if (!employee) {
      res.status(404).json({ message: 'Employee record not found' });
      return;
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if already punched in today
    const existing = await prisma.attendanceLog.findFirst({
      where: { employeeId: employee.id, date: { gte: today, lt: tomorrow } },
    });
    if (existing?.punchIn && !existing.punchOut) {
      res.status(409).json({ message: 'Already punched in — punch out first' });
      return;
    }

    const { lat, lng, attendanceMode = 'Office' } = req.body as {
      lat?: number; lng?: number; attendanceMode?: string;
    };

    // Get employee's shift timings
    let shiftStart = '09:00';
    let lateThreshold = 15;
    if (employee.shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: employee.shiftId } });
      if (shift) {
        shiftStart = shift.startTime;
        lateThreshold = shift.gracePeriodMinutes;
      }
    } else {
      const settings = await prisma.appSettings.findFirst();
      shiftStart = settings?.shiftStart || '09:00';
      lateThreshold = settings?.lateThresholdMinutes ?? 15;
    }

    const [sh, sm] = shiftStart.split(':').map(Number);
    const shiftStartTime = new Date(now);
    shiftStartTime.setHours(sh, sm, 0, 0);
    const lateByMinutes = (now.getTime() - shiftStartTime.getTime()) / (1000 * 60);
    const status: 'Present' | 'Late' = lateByMinutes > lateThreshold ? 'Late' : 'Present';

    const log = await prisma.attendanceLog.upsert({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
      update: {
        punchIn: now,
        status,
        attendanceMode: attendanceMode as 'Office' | 'WFH' | 'Field' | 'ClientVisit',
        source: 'app',
        appPunched: true,
        ...(lat !== undefined && lng !== undefined ? { punchInLat: lat, punchInLng: lng } : {}),
      },
      create: {
        employeeId: employee.id,
        date: today,
        punchIn: now,
        status,
        attendanceMode: attendanceMode as 'Office' | 'WFH' | 'Field' | 'ClientVisit',
        source: 'app',
        appPunched: true,
        ...(lat !== undefined && lng !== undefined ? { punchInLat: lat, punchInLng: lng } : {}),
      },
    });

    res.json({
      message: `Punched in at ${now.toLocaleTimeString()} — ${status}`,
      log,
      status,
      lateByMinutes: Math.max(0, Math.round(lateByMinutes)),
    });
  }
);

// ─── POST /api/attendance/punch-out ───────────────────────────────────────────
router.post(
  '/punch-out',
  [
    body('lat').optional().isFloat({ min: -90, max: 90 }),
    body('lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const employee = await prisma.employee.findFirst({ where: { userId: req.user!.id } });
    if (!employee) {
      res.status(404).json({ message: 'Employee record not found' });
      return;
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const log = await prisma.attendanceLog.findFirst({
      where: { employeeId: employee.id, date: { gte: today, lt: tomorrow } },
    });

    if (!log?.punchIn) {
      res.status(409).json({ message: 'No punch-in found for today — punch in first' });
      return;
    }
    if (log.punchOut) {
      res.status(409).json({ message: 'Already punched out today' });
      return;
    }

    const { lat, lng } = req.body as { lat?: number; lng?: number };

    const workHours = (now.getTime() - log.punchIn.getTime()) / (1000 * 60 * 60);

    // Recalculate status with actual work hours
    let halfDayThreshold = 4;
    let lateThreshold = 15;
    let shiftStart = '09:00';
    if (employee.shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: employee.shiftId } });
      if (shift) {
        shiftStart = shift.startTime;
        lateThreshold = shift.gracePeriodMinutes;
        halfDayThreshold = shift.halfDayThresholdHours;
      }
    } else {
      const settings = await prisma.appSettings.findFirst();
      shiftStart = settings?.shiftStart || '09:00';
      lateThreshold = settings?.lateThresholdMinutes ?? 15;
      halfDayThreshold = settings?.halfDayThresholdHours ?? 4;
    }

    const [sh, sm] = shiftStart.split(':').map(Number);
    const shiftStartTime = new Date(log.punchIn);
    shiftStartTime.setHours(sh, sm, 0, 0);
    const lateByMinutes = (log.punchIn.getTime() - shiftStartTime.getTime()) / (1000 * 60);

    let status: 'Present' | 'Late' | 'HalfDay';
    if (workHours < halfDayThreshold) {
      status = 'HalfDay';
    } else if (lateByMinutes > lateThreshold) {
      status = 'Late';
    } else {
      status = 'Present';
    }

    const updatedLog = await prisma.attendanceLog.update({
      where: { id: log.id },
      data: {
        punchOut: now,
        workHours: parseFloat(workHours.toFixed(2)),
        status,
        ...(lat !== undefined && lng !== undefined ? { punchOutLat: lat, punchOutLng: lng } : {}),
      },
    });

    res.json({
      message: `Punched out at ${now.toLocaleTimeString()} — ${workHours.toFixed(1)}h worked`,
      log: updatedLog,
      workHours: parseFloat(workHours.toFixed(2)),
      status,
    });
  }
);

// ─── POST /api/attendance/wfh-request ─────────────────────────────────────────
router.post(
  '/wfh-request',
  [
    body('date').isISO8601().withMessage('Valid date required'),
    body('mode').isIn(['WFH', 'Field', 'ClientVisit']).withMessage('Mode must be WFH, Field, or ClientVisit'),
    body('reason').trim().isLength({ min: 5 }).withMessage('Reason must be at least 5 characters'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const employee = await prisma.employee.findFirst({ where: { userId: req.user!.id } });
    if (!employee) {
      res.status(404).json({ message: 'Employee record not found' });
      return;
    }

    const { date, mode, reason } = req.body as { date: string; mode: string; reason: string };

    const requestDate = new Date(date);
    requestDate.setHours(0, 0, 0, 0);

    // Check for duplicate on same date
    const existing = await prisma.wFHRequest.findFirst({
      where: { employeeId: employee.id, date: requestDate },
    });
    if (existing) {
      res.status(409).json({ message: 'A work arrangement request already exists for this date' });
      return;
    }

    const request = await prisma.wFHRequest.create({
      data: {
        employeeId: employee.id,
        date: requestDate,
        mode: mode as 'WFH' | 'Field' | 'ClientVisit',
        reason,
        status: 'Pending',
      },
    });

    res.status(201).json({ message: 'Work arrangement request submitted', request });
  }
);

// ─── GET /api/attendance/wfh-requests ─────────────────────────────────────────
router.get(
  '/wfh-requests',
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { status, employeeId } = req.query as { status?: string; employeeId?: string };

    // Employees can only view their own requests
    if (req.user?.role === 'Employee') {
      const emp = await prisma.employee.findFirst({ where: { userId: req.user.id } });
      if (!emp) { res.status(404).json({ message: 'Employee not found' }); return; }
      const requests = await prisma.wFHRequest.findMany({
        where: { employeeId: emp.id, ...(status ? { status: status as 'Pending' | 'Approved' | 'Rejected' } : {}) },
        orderBy: { date: 'desc' },
      });
      res.json(requests);
      return;
    }

    // Admin/HR can see all
    const requests = await prisma.wFHRequest.findMany({
      where: {
        ...(status ? { status: status as 'Pending' | 'Approved' | 'Rejected' } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: { include: { user: { select: { name: true, email: true } } } } },
      orderBy: { date: 'desc' },
    });
    res.json(requests);
  }
);

// ─── PUT /api/attendance/wfh-requests/:id/review ──────────────────────────────
router.put(
  '/wfh-requests/:id/review',
  requireRole(['Admin', 'HR']),
  [
    body('status').isIn(['Approved', 'Rejected']).withMessage('Status must be Approved or Rejected'),
    body('reviewComment').optional().isString(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const request = await prisma.wFHRequest.findUnique({ where: { id: req.params.id } });
    if (!request) {
      res.status(404).json({ message: 'WFH request not found' });
      return;
    }

    const { status, reviewComment } = req.body as { status: 'Approved' | 'Rejected'; reviewComment?: string };

    const updated = await prisma.wFHRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        ...(reviewComment ? { reviewComment } : {}),
      },
    });

    // If approved, update the attendance log's mode for that date
    if (status === 'Approved') {
      const requestDay = new Date(request.date);
      requestDay.setHours(0, 0, 0, 0);
      const nextDay = new Date(requestDay);
      nextDay.setDate(nextDay.getDate() + 1);
      await prisma.attendanceLog.updateMany({
        where: { employeeId: request.employeeId, date: { gte: requestDay, lt: nextDay } },
        data: { attendanceMode: request.mode },
      });
    }

    res.json({ message: `WFH request ${status}`, request: updated });
  }
);

// ─── POST /api/attendance/push-punches ──────────────────────────────────────
// Mobile → push raw eSSL punches → save to PostgreSQL AttendanceLog
// Called by the mobile app every 5s (live) and once for historical import (Jan 1 → today)
router.post(
  '/push-punches',
  requireRole(['Admin', 'HR']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { punches } = req.body as {
      punches: Array<{ empCode: string; timestamp: string; direction: 'in' | 'out' }>;
    };

    if (!Array.isArray(punches) || punches.length === 0) {
      res.status(400).json({ message: 'punches array is required and must not be empty' });
      return;
    }

    // ── Group punches by employee+date ──────────────────────────────────────
    const grouped = new Map<string, { empCode: string; dateStr: string; entries: Array<{ ts: Date; dir: 'in' | 'out' }> }>();
    for (const p of punches) {
      const ts = new Date(p.timestamp.replace(' ', 'T'));
      if (isNaN(ts.getTime())) continue;
      const dateStr = ts.toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
      const key = `${p.empCode}__${dateStr}`;
      if (!grouped.has(key)) grouped.set(key, { empCode: p.empCode, dateStr, entries: [] });
      grouped.get(key)!.entries.push({ ts, dir: p.direction });
    }

    // ── Shared shift settings ───────────────────────────────────────────────
    const settings = await prisma.appSettings.findFirst();
    const globalShiftStart = settings?.shiftStart || '09:00';
    const globalLateMin = settings?.lateThresholdMinutes ?? 15;
    const globalHalfDayHrs = settings?.halfDayThresholdHours ?? 4;

    let saved = 0;
    let skipped = 0;

    for (const [, group] of grouped) {
      // ── Find or create employee ─────────────────────────────────────────
      let employee = await prisma.employee.findFirst({
        where: { OR: [{ employeeId: group.empCode }, { devicePin: group.empCode }] },
        select: { id: true, shiftId: true },
      });

      if (!employee) {
        try {
          const email = `device.pin.${group.empCode}@device.local`;
          let user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            const tempPw = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
            user = await prisma.user.create({
              data: {
                name: `Employee ${group.empCode}`,
                email,
                passwordHash: tempPw,
                role: 'Employee',
                isEmailVerified: false,
              },
            });
          }
          const existing = await prisma.employee.findUnique({ where: { userId: user.id } });
          employee = existing ?? await prisma.employee.create({
            data: {
              userId: user.id,
              employeeId: group.empCode,
              department: 'To Be Updated',
              designation: 'To Be Updated',
              joinDate: new Date(),
              isActive: true,
            },
          });
        } catch {
          skipped++;
          continue;
        }
      }

      // ── Compute punchIn / punchOut / workHours / status ─────────────────
      const sorted = group.entries.sort((a, b) => a.ts.getTime() - b.ts.getTime());
      const punchIn = sorted[0].ts;
      const punchOut = sorted.length > 1 ? sorted[sorted.length - 1].ts : null;
      const workHours = punchOut ? (punchOut.getTime() - punchIn.getTime()) / (1000 * 60 * 60) : 0;

      let shiftStart = globalShiftStart;
      let lateMin = globalLateMin;
      let halfDayHrs = globalHalfDayHrs;
      if (employee.shiftId) {
        const shift = await prisma.shift.findUnique({ where: { id: employee.shiftId } });
        if (shift) {
          shiftStart = shift.startTime;
          lateMin = shift.gracePeriodMinutes;
          halfDayHrs = shift.halfDayThresholdHours;
        }
      }

      const [sh, sm] = shiftStart.split(':').map(Number);
      const shiftTime = new Date(punchIn);
      shiftTime.setHours(sh, sm, 0, 0);
      const lateBy = (punchIn.getTime() - shiftTime.getTime()) / (1000 * 60);

      let status: 'Present' | 'Late' | 'HalfDay' = 'Present';
      if (workHours > 0 && workHours < halfDayHrs) {
        status = 'HalfDay';
      } else if (lateBy > lateMin) {
        status = 'Late';
      }

      // ── Upsert AttendanceLog ────────────────────────────────────────────
      // date must be midnight UTC for @db.Date
      const date = new Date(`${group.dateStr}T00:00:00.000Z`);
      try {
        await prisma.attendanceLog.upsert({
          where: { employeeId_date: { employeeId: employee.id, date } },
          update: {
            punchIn,
            ...(punchOut ? { punchOut } : {}),
            workHours: parseFloat(workHours.toFixed(2)),
            status,
            source: 'essl',
          },
          create: {
            employeeId: employee.id,
            date,
            punchIn,
            punchOut: punchOut ?? undefined,
            workHours: parseFloat(workHours.toFixed(2)),
            status,
            source: 'essl',
          },
        });
        saved++;
      } catch {
        skipped++;
      }
    }

    res.json({ success: true, saved, skipped, total: punches.length });
  }
);

// ─── GET /api/attendance/by-date ─────────────────────────────────────────────
// ?date=YYYY-MM-DD  OR  ?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/by-date', requireRole(['Admin', 'HR']), async (req: AuthRequest, res: Response): Promise<void> => {
  const { date, from, to } = req.query as { date?: string; from?: string; to?: string };

  let startDate: Date;
  let endDate: Date;

  if (date) {
    startDate = new Date(`${date}T00:00:00.000Z`);
    endDate   = new Date(`${date}T23:59:59.999Z`);
  } else if (from && to) {
    startDate = new Date(`${from}T00:00:00.000Z`);
    endDate   = new Date(`${to}T23:59:59.999Z`);
  } else {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    startDate = today;
    endDate   = new Date(today);
    endDate.setUTCHours(23, 59, 59, 999);
  }

  const logs = await prisma.attendanceLog.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    include: { employee: { include: { user: { select: { name: true } } } } },
    orderBy: [{ date: 'asc' }, { punchIn: 'asc' }],
  });

  const feed = logs.map((l) => ({
    id:            l.id,
    empCode:       l.employee.employeeId,
    employeeDbId:  l.employee.id,
    name:          l.employee.user?.name || `Employee ${l.employee.employeeId}`,
    department:    l.employee.department,
    date:          l.date.toISOString().split('T')[0],
    punchIn:       l.punchIn?.toISOString()  ?? null,
    punchOut:      l.punchOut?.toISOString() ?? null,
    workHours:     l.workHours,
    status:        l.status,
    source:        l.source,
  }));

  res.json({ feed, total: feed.length });
});

// ─── GET /api/attendance/live-feed ───────────────────────────────────────────
// Returns today's attendance with employee names for the live attendance board
router.get('/live-feed', requireRole(['Admin', 'HR']), async (_req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const logs = await prisma.attendanceLog.findMany({
    where: { date: { gte: today, lt: tomorrow } },
    include: {
      employee: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: { punchIn: 'desc' },
  });

  const feed = logs.map((l) => ({
    id: l.id,
    empCode: l.employee.employeeId,
    name: l.employee.user?.name || `Employee ${l.employee.employeeId}`,
    department: l.employee.department,
    punchIn: l.punchIn?.toISOString() ?? null,
    punchOut: l.punchOut?.toISOString() ?? null,
    workHours: l.workHours,
    status: l.status,
    source: l.source,
  }));

  res.json({ feed, date: today.toISOString().split('T')[0], total: feed.length });
});

// ─── DELETE /api/attendance/* — BLOCKED ─────────────────────────────────────
// Attendance data is permanent: records can only be updated/corrected, never deleted.
router.delete('*', (_req, res: Response): void => {
  res.status(405).json({ message: 'Attendance records cannot be deleted. Use regularize to correct data.' });
});

export default router;
