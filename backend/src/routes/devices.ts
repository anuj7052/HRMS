import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { Device } from '../models/Device';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/auth';
import { syncDevice, testDeviceConnection, processAttendanceFromRaw } from '../services/esslService';
import { fetchFromETimeTrackLite, parseManualAttendanceData, encryptForStorage, decryptFromStorage, fetchEmployeesFromETL, fetchFromIClockServerDirect } from '../services/etlService';
import { RawPunchLog } from '../models/AttendanceLog';
import { io } from '../server';

const router = Router();
router.use(authenticateJWT);

// ─── GET /api/devices ────────────────────────────────────────────────────────
router.get('/', requireRole(['Admin', 'HR']), async (_req, res: Response): Promise<void> => {
  const devices = await Device.find().select('-passwordHash').lean();
  res.json(devices);
});

// ─── POST /api/devices ───────────────────────────────────────────────────────
router.post(
  '/',
  requireRole(['Admin']),
  [
    body('name').trim().notEmpty(),
    body('ip').matches(/^(\d{1,3}\.){3}\d{1,3}$/).withMessage('Invalid IP address'),
    body('port').isInt({ min: 1, max: 65535 }),
    body('serialNumber').trim().notEmpty(),
    body('username').trim().notEmpty(),
    body('password').notEmpty(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, ip, port, serialNumber, username, password } = req.body as {
      name: string; ip: string; port: number;
      serialNumber: string; username: string; password: string;
    };

    const existing = await Device.findOne({ serialNumber });
    if (existing) {
      res.status(409).json({ message: 'Device with this serial number already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const device = await Device.create({ name, ip, port, serialNumber, username, passwordHash });

    res.status(201).json({ message: 'Device added', device: { ...device.toObject(), passwordHash: undefined } });
  }
);

// ─── PUT /api/devices/:id ────────────────────────────────────────────────────
router.put('/:id', requireRole(['Admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findById(req.params.id).select('+passwordHash');
  if (!device) {
    res.status(404).json({ message: 'Device not found' });
    return;
  }

  const { name, ip, port, serialNumber, username, password, isActive } = req.body as {
    name?: string; ip?: string; port?: number; serialNumber?: string;
    username?: string; password?: string; isActive?: boolean;
  };

  if (name) device.name = name;
  if (ip) device.ip = ip;
  if (port) device.port = port;
  if (serialNumber) device.serialNumber = serialNumber;
  if (username) device.username = username;
  if (password) device.passwordHash = await bcrypt.hash(password, 10);
  if (isActive !== undefined) device.isActive = isActive;

  await device.save();
  res.json({ message: 'Device updated' });
});

// ─── DELETE /api/devices/:id ─────────────────────────────────────────────────
router.delete('/:id', requireRole(['Admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findByIdAndDelete(req.params.id);
  if (!device) {
    res.status(404).json({ message: 'Device not found' });
    return;
  }
  res.json({ message: 'Device deleted' });
});

// ─── POST /api/devices/:id/test-connection ────────────────────────────────────
router.post('/:id/test-connection', requireRole(['Admin', 'HR']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findById(req.params.id);
  if (!device) {
    res.status(404).json({ message: 'Device not found' });
    return;
  }
  const result = await testDeviceConnection(device);
  res.json(result);
});

// ─── POST /api/devices/:id/sync ──────────────────────────────────────────────
// Accepts optional body: { fromDate: "YYYY-MM-DD" }
router.post('/:id/sync', requireRole(['Admin', 'HR']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findById(req.params.id).select('+passwordHash');
  if (!device) {
    res.status(404).json({ message: 'Device not found' });
    return;
  }

  const { fromDate } = req.body as { fromDate?: string };
  let fromDateObj: Date | undefined;
  if (fromDate) {
    fromDateObj = new Date(fromDate);
    fromDateObj.setHours(0, 0, 0, 0);
    if (isNaN(fromDateObj.getTime())) {
      res.status(400).json({ message: 'Invalid fromDate. Use YYYY-MM-DD format.' });
      return;
    }
  }

  const result = await syncDevice(device, fromDateObj);
  res.json(result);
});

// ─── PUT /api/devices/:id/etl-credentials ────────────────────────────────────
// Save eTimeTrackLite web portal username & password for the device.
// Password is AES-256-CBC encrypted (not bcrypt) so it can be retrieved for auto-sync.
router.put('/:id/etl-credentials', requireRole(['Admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findById(req.params.id).select('+etlPassword +etlUsername');
  if (!device) { res.status(404).json({ message: 'Device not found' }); return; }

  const { etlUsername, etlPassword, autoSync, syncInterval } = req.body as {
    etlUsername: string; etlPassword: string;
    autoSync?: boolean; syncInterval?: number;
  };
  if (!etlUsername || !etlPassword) {
    res.status(400).json({ message: 'etlUsername and etlPassword are required' }); return;
  }

  device.etlUsername = etlUsername.trim();
  device.etlPassword = encryptForStorage(etlPassword);
  if (autoSync !== undefined) device.autoSync = autoSync;
  if (syncInterval) device.syncInterval = syncInterval;
  await device.save();
  res.json({ message: 'eTimeTrackLite credentials saved' });
});

// ─── POST /api/devices/:id/test-etl-credentials ───────────────────────────────
// Test eTimeTrackLite portal login without saving credentials
router.post('/:id/test-etl-credentials', requireRole(['Admin', 'HR']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findById(req.params.id);
  if (!device) { res.status(404).json({ message: 'Device not found' }); return; }

  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ success: false, message: 'Username and password are required' }); return;
  }

  const baseUrl = `http://${device.ip}:${device.port}`;
  try {
    const { fetchFromETimeTrackLite } = await import('../services/etlService');
    // Use a tiny date range just to test login — no records expected
    const today = new Date().toISOString().split('T')[0];
    const result = await fetchFromETimeTrackLite(baseUrl, username, password, today, today);
    if (result.success) {
      res.json({ success: true, message: `Login successful! Portal is accessible. ${result.records.length} records found for today.` });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: (e as Error).message });
  }
});

// ─── POST /api/devices/:id/configure-etl ─────────────────────────────────────
// One-shot: save credentials + optionally trigger employee sync + backfill.
// Body: { etlUsername, etlPassword, autoSync?, syncInterval?, fetchFrom?, syncEmployees? }
router.post('/:id/configure-etl', requireRole(['Admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findById(req.params.id).select('+etlPassword +etlUsername');
  if (!device) { res.status(404).json({ message: 'Device not found' }); return; }

  const {
    etlUsername, etlPassword,
    autoSync = true, syncInterval = 5,
    fetchFrom = '2026-04-01',
    syncEmployees = true,
  } = req.body as {
    etlUsername: string; etlPassword: string;
    autoSync?: boolean; syncInterval?: number;
    fetchFrom?: string; syncEmployees?: boolean;
  };

  if (!etlUsername || !etlPassword) {
    res.status(400).json({ message: 'etlUsername and etlPassword are required' }); return;
  }

  // Save credentials
  device.etlUsername = etlUsername.trim();
  device.etlPassword = encryptForStorage(etlPassword);
  device.autoSync = autoSync;
  device.syncInterval = syncInterval;
  await device.save();

  const baseUrl = `http://${device.ip}:${device.port}`;
  const toDate = new Date().toISOString().split('T')[0];

  // Respond immediately, run backfill async
  res.json({
    success: true,
    message: `Credentials saved. Auto-sync ${autoSync ? 'enabled' : 'disabled'}. Backfill from ${fetchFrom} running in background.`,
    autoSync,
    syncInterval,
  });

  // ── Background: employee sync + historical backfill ──────────────────────────
  (async () => {
    try {
      if (syncEmployees) {
        const empResult = await fetchEmployeesFromETL(baseUrl, etlUsername, etlPassword);
        if (empResult.success && empResult.employees.length > 0) {
          const { User } = await import('../models/User');
          const { Employee } = await import('../models/Employee');
          const bcrypt = await import('bcryptjs');
          let created = 0;
          for (const emp of empResult.employees) {
            const existing = await Employee.findOne({ employeeId: emp.pin });
            if (!existing) {
              const email = `device.pin.${emp.pin}@device.local`;
              let user = await User.findOne({ email });
              if (!user) {
                const tempPw = await bcrypt.hash(Math.random().toString(36), 10);
                user = await User.create({
                  name: emp.name,
                  email,
                  passwordHash: tempPw,
                  role: 'Employee',
                  isEmailVerified: false,
                });
              } else {
                // update name if it was a placeholder
                if (user.name.startsWith('Employee ')) {
                  await User.findByIdAndUpdate(user._id, { name: emp.name });
                }
              }
              const existingEmp = await Employee.findOne({ userId: user._id });
              if (!existingEmp) {
                await Employee.create({
                  userId: user._id,
                  employeeId: emp.pin,
                  department: emp.department || 'To Be Updated',
                  designation: 'To Be Updated',
                  joinDate: new Date(),
                  isActive: true,
                });
                created++;
              }
            }
          }
          console.log(`[ConfigureETL] Employee sync: ${created} new employees created from device`);
        }
      }
    } catch (e) {
      console.error('[ConfigureETL] Employee sync error:', (e as Error).message);
    }

    try {
      const result = await fetchFromETimeTrackLite(baseUrl, etlUsername, etlPassword, fetchFrom, toDate);
      let newLogs = 0;
      const fromDateObj = new Date(fetchFrom);
      fromDateObj.setHours(0, 0, 0, 0);
      for (const record of result.records) {
        if (record.timestamp < fromDateObj) continue;
        try {
          await RawPunchLog.create({
            deviceId: device._id,
            employeeDeviceId: record.employeeDeviceId,
            timestamp: record.timestamp,
            punchType: record.punchType,
            raw: record.raw,
          });
          newLogs++;
        } catch { /* duplicate */ }
      }
      if (newLogs > 0) {
        await processAttendanceFromRaw(String(device._id), fromDateObj);
      }
      await Device.findByIdAndUpdate(device._id, {
        lastEtlSync: new Date(), status: 'Online', lastSync: new Date(), lastError: undefined,
      });
      io.emit('attendance:update', { deviceId: device._id, synced: newLogs });
      console.log(`[ConfigureETL] Backfill complete: ${newLogs} new records (${result.records.length} fetched)`);
    } catch (e) {
      console.error('[ConfigureETL] Backfill error:', (e as Error).message);
      await Device.findByIdAndUpdate(device._id, { lastError: (e as Error).message });
    }
  })();
});

// ─── POST /api/devices/:id/sync-now ──────────────────────────────────────────
// Immediate live sync: tries ESSL REST API → iClock cdata pull → portal scraping
router.post('/:id/sync-now', requireRole(['Admin', 'HR']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findById(req.params.id).select('+etlPassword +etlUsername');
  if (!device) { res.status(404).json({ message: 'Device not found' }); return; }

  let password: string | undefined;
  if (device.etlPassword) {
    try { password = decryptFromStorage(device.etlPassword); } catch { /* bad stored creds */ }
  }

  const baseUrl = `http://${device.ip}:${device.port}`;
  const result = await fetchFromIClockServerDirect(
    baseUrl,
    device.serialNumber,
    device.lastEtlSync ?? undefined,
    device.etlUsername ?? undefined,
    password,
  );

  if (!result.success && result.records.length === 0) {
    res.status(400).json({ message: result.message, logsImported: 0 }); return;
  }

  // Save raw punch logs
  const cutoff = device.lastEtlSync
    ? new Date(device.lastEtlSync.getTime() - 2 * 60 * 60 * 1000)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  let newLogs = 0;
  for (const record of result.records) {
    if (record.timestamp < cutoff) continue;
    try {
      await RawPunchLog.create({
        deviceId: device._id,
        employeeDeviceId: record.employeeDeviceId,
        timestamp: record.timestamp,
        punchType: record.punchType,
        raw: record.raw,
      });
      newLogs++;
    } catch { /* duplicate */ }
  }

  if (newLogs > 0) {
    await processAttendanceFromRaw(String(device._id));
  }
  await Device.findByIdAndUpdate(device._id, {
    lastEtlSync: new Date(), status: 'Online', lastSync: new Date(), lastError: undefined,
  });
  io.emit('attendance:update', { deviceId: device._id, synced: newLogs });

  res.json({
    success: true,
    message: `${result.message}. ${newLogs} new punch logs stored.`,
    logsImported: newLogs,
    total: result.records.length,
  });
});

// ─── POST /api/devices/:id/fetch-from-etl ────────────────────────────────────
// Login to eTimeTrackLite and scrape attendance data for a date range.
// If etlUsername/etlPassword not provided, uses saved credentials from DB.
router.post('/:id/fetch-from-etl', requireRole(['Admin', 'HR']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findById(req.params.id).select('+etlUsername +etlPassword +passwordHash');
  if (!device) { res.status(404).json({ message: 'Device not found' }); return; }

  const { fromDate, toDate, etlPassword, etlUsername: etlUsernameBody } = req.body as {
    fromDate: string; toDate?: string; etlPassword?: string; etlUsername?: string;
  };

  if (!fromDate) { res.status(400).json({ message: 'fromDate is required (YYYY-MM-DD)' }); return; }

  const to = toDate || new Date().toISOString().split('T')[0];
  const baseUrl = `http://${device.ip}:${device.port}`;
  const etlUser = etlUsernameBody || device.etlUsername;

  if (!etlUser) {
    res.status(400).json({ message: 'Provide etlUsername or configure credentials via Configure button.' }); return;
  }

  // Resolve password: explicit body > decrypt stored
  let plainPassword = etlPassword || '';
  if (!plainPassword && device.etlPassword) {
    try { plainPassword = decryptFromStorage(device.etlPassword); }
    catch { res.status(500).json({ message: 'Stored credentials corrupted. Re-enter via Configure.' }); return; }
  }
  if (!plainPassword) {
    res.status(400).json({ message: 'Provide etlPassword or configure credentials via Configure button.' }); return;
  }

  const result = await fetchFromETimeTrackLite(baseUrl, etlUser, plainPassword, fromDate, to);

  if (!result.success) {
    res.status(400).json({ message: result.message, logsImported: 0 }); return;
  }

  let newLogs = 0;
  const fromDateObj = new Date(fromDate);
  fromDateObj.setHours(0, 0, 0, 0);

  for (const record of result.records) {
    if (record.timestamp < fromDateObj) continue;
    try {
      await RawPunchLog.create({
        deviceId: device._id,
        employeeDeviceId: record.employeeDeviceId,
        timestamp: record.timestamp,
        punchType: record.punchType,
        raw: record.raw,
      });
      newLogs++;
    } catch {
      // Duplicate — skip
    }
  }

  await processAttendanceFromRaw(String(device._id), fromDateObj);

  await Device.findByIdAndUpdate(device._id, { status: 'Online', lastSync: new Date(), lastEtlSync: new Date(), lastError: undefined });
  io.emit('attendance:update', { deviceId: device._id, synced: newLogs });

  res.json({
    success: true,
    message: `${result.message}. ${newLogs} new records stored.`,
    logsImported: newLogs,
    total: result.records.length,
  });
});

// ─── POST /api/devices/:id/manual-import ─────────────────────────────────────
// Paste or upload raw attendance log lines (iClock TAB-delimited format)
// Body: { data: "PIN\tDate Time\tVerify\tPunch\n..." }
router.post('/:id/manual-import', requireRole(['Admin', 'HR']), async (req: AuthRequest, res: Response): Promise<void> => {
  const device = await Device.findById(req.params.id);
  if (!device) { res.status(404).json({ message: 'Device not found' }); return; }

  const { data, fromDate } = req.body as { data: string; fromDate?: string };
  if (!data || !data.trim()) {
    res.status(400).json({ message: 'data field is required with attendance log lines' }); return;
  }

  const records = parseManualAttendanceData(data);
  if (records.length === 0) {
    res.status(400).json({ message: 'No valid attendance records found in provided data. Expected format: PIN\\tDate Time\\tVerifyType\\tPunchType' });
    return;
  }

  const fromDateObj = fromDate ? new Date(fromDate) : undefined;
  if (fromDateObj) fromDateObj.setHours(0, 0, 0, 0);

  let newLogs = 0;
  for (const record of records) {
    if (fromDateObj && record.timestamp < fromDateObj) continue;
    try {
      await RawPunchLog.create({
        deviceId: device._id,
        employeeDeviceId: record.employeeDeviceId,
        timestamp: record.timestamp,
        punchType: record.punchType,
        raw: record.raw,
      });
      newLogs++;
    } catch {
      // Duplicate — skip
    }
  }

  await processAttendanceFromRaw(String(device._id), fromDateObj);
  await Device.findByIdAndUpdate(device._id, { lastSync: new Date(), lastError: undefined });
  io.emit('attendance:update', { deviceId: device._id, synced: newLogs });

  res.json({
    success: true,
    message: `Import complete. ${newLogs} new records stored (${records.length} total parsed).`,
    logsImported: newLogs,
    parsed: records.length,
  });
});

export default router;
