import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AppSettings } from '../models/AppSettings';
import { AttendanceLog } from '../models/AttendanceLog';
import { Employee } from '../models/Employee';
import { Shift } from '../models/Shift';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// ─── GET /api/settings ───────────────────────────────────────────────────────
router.get('/', async (_req, res: Response): Promise<void> => {
  let settings = await AppSettings.findOne();
  if (!settings) {
    settings = await AppSettings.create({});
  }
  // Don't expose SMTP password
  const obj = settings.toObject() as unknown as Record<string, unknown>;
  delete obj.smtpPass;
  res.json(obj);
});

// ─── PUT /api/settings ───────────────────────────────────────────────────────
router.put(
  '/',
  requireRole(['Admin']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    let settings = await AppSettings.findOne();
    if (!settings) settings = new AppSettings();

    const allowed = [
      'allowedEmailDomains', 'shiftStart', 'shiftEnd', 'lateThresholdMinutes',
      'halfDayThresholdHours', 'workingDays', 'holidays', 'smtpHost',
      'smtpPort', 'smtpUser', 'smtpPass', 'smtpFrom', 'emailNotificationsEnabled',
    ];

    for (const key of allowed) {
      if ((req.body as Record<string, unknown>)[key] !== undefined) {
        (settings as unknown as Record<string, unknown>)[key] = (req.body as Record<string, unknown>)[key];
      }
    }

    await settings.save();
    res.json({ message: 'Settings updated' });
  }
);

// ─── POST /api/settings/apply-holidays ───────────────────────────────────────
// Creates/updates attendance records for all employees on every configured holiday date.
// Skips dates that already have actual punch data (Present/Late/HalfDay).
router.post('/apply-holidays', requireRole(['Admin']), async (_req: AuthRequest, res: Response): Promise<void> => {
  const settings = await AppSettings.findOne();
  if (!settings || !settings.holidays || settings.holidays.length === 0) {
    res.status(400).json({ message: 'No holidays configured in settings' }); return;
  }

  const employees = await Employee.find({}).select('_id').lean();
  let applied = 0;
  let skipped = 0;

  for (const holiday of settings.holidays) {
    const d = new Date(holiday.date);
    d.setHours(0, 0, 0, 0);

    for (const emp of employees) {
      const existing = await AttendanceLog.findOne({ employeeId: emp._id, date: d });
      if (existing) {
        if (['Absent', 'Holiday', 'WeeklyOff'].includes(existing.status)) {
          await AttendanceLog.updateOne(
            { _id: existing._id },
            { $set: { status: 'Holiday', source: 'holiday-import', punchIn: undefined, punchOut: undefined, workHours: 0 } }
          );
          applied++;
        } else {
          skipped++; // has punch data — don't overwrite
        }
      } else {
        await AttendanceLog.create({
          employeeId: emp._id,
          date: d,
          status: 'Holiday',
          workHours: 0,
          source: 'holiday-import',
          isRegularized: false,
        });
        applied++;
      }
    }
  }

  res.json({
    message: `Applied ${settings.holidays.length} holidays to ${employees.length} employees. ${applied} records created/updated, ${skipped} skipped (had punch data).`,
    applied,
    skipped,
  });
});

// ─── GET /api/settings/shifts ─────────────────────────────────────────────────
router.get('/shifts', async (_req, res: Response): Promise<void> => {
  const shifts = await Shift.find().sort({ name: 1 }).lean();
  res.json(shifts);
});

// ─── POST /api/settings/shifts ────────────────────────────────────────────────
router.post(
  '/shifts',
  requireRole(['Admin']),
  [
    body('name').trim().notEmpty().withMessage('Shift name is required'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:MM'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:MM'),
    body('gracePeriodMinutes').optional().isInt({ min: 0 }),
    body('halfDayThresholdHours').optional().isFloat({ min: 1 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, startTime, endTime, gracePeriodMinutes, halfDayThresholdHours } = req.body as {
      name: string; startTime: string; endTime: string;
      gracePeriodMinutes?: number; halfDayThresholdHours?: number;
    };

    const existing = await Shift.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      res.status(409).json({ message: 'A shift with this name already exists' });
      return;
    }

    const shift = await Shift.create({
      name,
      startTime,
      endTime,
      gracePeriodMinutes: gracePeriodMinutes ?? 15,
      halfDayThresholdHours: halfDayThresholdHours ?? 4,
    });

    res.status(201).json(shift);
  }
);

// ─── PUT /api/settings/shifts/:id ─────────────────────────────────────────────
router.put(
  '/shifts/:id',
  requireRole(['Admin']),
  [
    body('startTime').optional().matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:MM'),
    body('endTime').optional().matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:MM'),
    body('gracePeriodMinutes').optional().isInt({ min: 0 }),
    body('halfDayThresholdHours').optional().isFloat({ min: 1 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      res.status(404).json({ message: 'Shift not found' });
      return;
    }

    const { name, startTime, endTime, gracePeriodMinutes, halfDayThresholdHours, isActive } = req.body as {
      name?: string; startTime?: string; endTime?: string;
      gracePeriodMinutes?: number; halfDayThresholdHours?: number; isActive?: boolean;
    };

    Object.assign(shift, {
      ...(name && { name }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(gracePeriodMinutes !== undefined && { gracePeriodMinutes }),
      ...(halfDayThresholdHours !== undefined && { halfDayThresholdHours }),
      ...(isActive !== undefined && { isActive }),
    });

    await shift.save();
    res.json(shift);
  }
);

// ─── DELETE /api/settings/shifts/:id ──────────────────────────────────────────
router.delete('/shifts/:id', requireRole(['Admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  const shift = await Shift.findById(req.params.id);
  if (!shift) {
    res.status(404).json({ message: 'Shift not found' });
    return;
  }
  // Check if any employees are using this shift
  const count = await Employee.countDocuments({ shiftId: req.params.id });
  if (count > 0) {
    res.status(409).json({ message: `Cannot delete — ${count} employee(s) are assigned to this shift. Reassign them first.` });
    return;
  }
  await shift.deleteOne();
  res.json({ message: 'Shift deleted' });
});

export default router;
