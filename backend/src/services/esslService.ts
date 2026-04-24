import axios from 'axios';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { io } from '../server';

type IDevice = { id: string; _id?: string; ip: string; port: number; serialNumber: string; username: string; passwordHash: string; name: string; isActive: boolean };

/**
 * eSSL iClock HTTP pull protocol
 * Endpoint: GET http://{ip}:{port}/iclock/data/iclock.cgi?CMD=GetLog&SN={serialNumber}
 * Response: tab-delimited lines: PIN\tDate&Time\tVerifyType\tPunchType\t...
 */

interface ParsedLog {
  employeeDeviceId: string;
  timestamp: Date;
  punchType: number;
  raw: string;
}

/**
 * Auto-create a placeholder User + Employee in PostgreSQL for an unknown device PIN.
 */
async function createPlaceholderEmployee(pin: string): Promise<{ id: string; shiftId: string | null } | null> {
  try {
    const email = `device.pin.${pin}@device.local`;
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const tempPw = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = await prisma.user.create({
        data: {
          name: `Employee ${pin}`,
          email,
          passwordHash: tempPw,
          role: 'Employee',
          isEmailVerified: false,
        },
      });
    }
    const existing = await prisma.employee.findUnique({ where: { userId: user.id } });
    if (existing) return existing;
    const emp = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeId: pin,
        department: 'To Be Updated',
        designation: 'To Be Updated',
        joinDate: new Date(),
        isActive: true,
      },
    });
    console.log(`[eSSL] Auto-created placeholder employee for device PIN ${pin} — update in Employees page`);
    return emp;
  } catch (e) {
    console.error(`[eSSL] Could not auto-create employee for PIN ${pin}:`, (e as Error).message);
    return null;
  }
}

function parseIClockLogs(rawData: string): ParsedLog[] {
  const results: ParsedLog[] = [];
  const lines = rawData.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip header/instruction lines
    if (line.startsWith('GET') || line.startsWith('OPTIONS')) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const [pin, dateTime, , punchTypeStr] = parts;
    if (!pin || !dateTime) continue;

    const timestamp = new Date(dateTime.replace(' ', 'T'));
    if (isNaN(timestamp.getTime())) continue;

    results.push({
      employeeDeviceId: pin.trim(),
      timestamp,
      punchType: parseInt(punchTypeStr || '0') || 0,
      raw: line,
    });
  }

  return results;
}

async function processAttendanceLogs(deviceId: string, fromDate?: Date): Promise<void> {
  const settings = await prisma.appSettings.findFirst();
  const globalShiftStart = settings?.shiftStart || '09:00';
  const globalLateThreshold = settings?.lateThresholdMinutes ?? 15;
  const globalHalfDayThreshold = settings?.halfDayThresholdHours ?? 4;

  // Read raw punch logs from PostgreSQL
  const rawLogs = await prisma.rawPunchLog.findMany({
    where: {
      deviceId,
      ...(fromDate ? { timestamp: { gte: fromDate } } : {}),
    },
  });

  const grouped = new Map<string, typeof rawLogs>();
  for (const log of rawLogs) {
    const dateKey = `${log.employeeDeviceId}__${log.timestamp.toISOString().split('T')[0]}`;
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(log);
  }

  for (const [key, logs] of grouped) {
    const [empDeviceId, dateStr] = key.split('__');

    let employee = await prisma.employee.findFirst({
      where: { OR: [{ employeeId: empDeviceId }, { devicePin: empDeviceId }] },
      select: { id: true, shiftId: true },
    });
    if (!employee) {
      employee = await createPlaceholderEmployee(empDeviceId);
    }
    if (!employee) continue;

    const sortedLogs = logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const punchIn = sortedLogs[0].timestamp;
    const punchOut = sortedLogs.length > 1 ? sortedLogs[sortedLogs.length - 1].timestamp : null;
    const workHours = punchOut
      ? (punchOut.getTime() - punchIn.getTime()) / (1000 * 60 * 60)
      : 0;

    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    let shiftStart = globalShiftStart;
    let lateThreshold = globalLateThreshold;
    let halfDayThreshold = globalHalfDayThreshold;
    if (employee.shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: employee.shiftId } });
      if (shift) {
        shiftStart = shift.startTime;
        lateThreshold = shift.gracePeriodMinutes;
        halfDayThreshold = shift.halfDayThresholdHours;
      }
    }

    const [shiftHour, shiftMin] = shiftStart.split(':').map(Number);
    const shiftStartTime = new Date(punchIn);
    shiftStartTime.setHours(shiftHour, shiftMin, 0, 0);
    const lateBy = (punchIn.getTime() - shiftStartTime.getTime()) / (1000 * 60);

    let status: 'Present' | 'Late' | 'HalfDay';
    if (workHours < halfDayThreshold) {
      status = 'HalfDay';
    } else if (lateBy > lateThreshold) {
      status = 'Late';
    } else {
      status = 'Present';
    }

    // Save attendance log to PostgreSQL
    await prisma.attendanceLog.upsert({
      where: { employeeId_date: { employeeId: employee.id, date } },
      update: { punchIn, punchOut, workHours: parseFloat(workHours.toFixed(2)), status, deviceId },
      create: {
        employeeId: employee.id,
        date,
        punchIn,
        punchOut,
        workHours: parseFloat(workHours.toFixed(2)),
        status,
        deviceId,
        source: 'device',
      },
    });
  }
}

/** Public alias used by the iClock push receiver route */
export async function processAttendanceFromRaw(deviceId: string, fromDate?: Date): Promise<void> {
  return processAttendanceLogs(deviceId, fromDate);
}

/**
 * Returns true only for network-level failures (device unreachable).
 * HTTP 4xx/5xx still means the device IS reachable — don't call it "Offline".
 */
function isNetworkError(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  const networkCodes = ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH'];
  if (code && networkCodes.includes(code)) return true;
  if (axios.isAxiosError(err) && !err.response) return true; // no response = unreachable
  return false;
}

/**
 * Try multiple known eSSL/ZKTeco endpoint patterns in order.
 * Different firmware versions use different paths.
 * Priority: /iclock/cdata (most common, confirmed working for eTimeTrackLite)
 */
async function fetchLogsFromDevice(device: IDevice): Promise<{ data: string; url: string }> {
  const base = `http://${device.ip}:${device.port}`;
  const sn = device.serialNumber;
  const candidateUrls = [
    `${base}/iclock/cdata?SN=${sn}&stamp=0&command_id=0`,
    `${base}/iclock/data/iclock.cgi?CMD=GetLog&SN=${sn}`,
    `${base}/cdata?SN=${sn}&stamp=0`,
    `${base}/iclock/GetLog?SN=${sn}`,
    `${base}/attendance/iclock/cdata?SN=${sn}&stamp=0`,
  ];

  let lastErr: unknown;
  for (const url of candidateUrls) {
    try {
      const response = await axios.get<string>(url, {
        timeout: 10000,
        headers: { Accept: 'text/plain' },
        validateStatus: (s) => s < 500, // accept 4xx so we can try next, but not 5xx
      });
      if (response.status === 200) {
        return { data: String(response.data), url };
      }
      // 4xx on this path — try next
      lastErr = new Error(`HTTP ${response.status} at ${url}`);
    } catch (err) {
      lastErr = err;
      if (isNetworkError(err)) throw err; // no point trying other paths if device is unreachable
    }
  }
  throw lastErr;
}

export async function syncDevice(
  device: IDevice,
  fromDate?: Date
): Promise<{ success: boolean; message: string; logsImported: number }> {
  try {
    const { data, url } = await fetchLogsFromDevice(device);
    console.log(`[eSSL] Fetched logs from ${url}${fromDate ? ` (filtering from ${fromDate.toISOString().split('T')[0]})` : ''}`);

    const parsed = parseIClockLogs(data);

    // If fromDate provided, only process records on/after that date
    const filtered = fromDate
      ? parsed.filter(l => l.timestamp >= fromDate)
      : parsed;

    let newLogs = 0;
    for (const log of filtered) {
      try {
        await prisma.rawPunchLog.create({
          data: {
            deviceId: device.id ?? String(device._id),
            employeeDeviceId: log.employeeDeviceId,
            timestamp: log.timestamp,
            punchType: log.punchType,
            raw: log.raw,
          },
        });
        newLogs++;
      } catch {
        // Duplicate — skip (unique index constraint)
      }
    }

    await processAttendanceLogs(device.id ?? String(device._id), fromDate);

    await prisma.device.update({
      where: { id: device.id ?? String(device._id) },
      data: { status: 'Online', lastSync: new Date(), lastError: null },
    });

    io.emit('attendance:update', { deviceId: device.id ?? device._id, synced: newLogs });

    const dateNote = fromDate ? ` since ${fromDate.toISOString().split('T')[0]}` : '';
    return { success: true, message: `Sync complete${dateNote}. ${newLogs} new punch records imported.`, logsImported: newLogs };
  } catch (err) {
    const isUnreachable = isNetworkError(err);
    const message = err instanceof Error ? err.message : 'Unknown sync error';

    await prisma.device.update({
      where: { id: device.id ?? String(device._id) },
      data: { status: isUnreachable ? 'Offline' : 'Online', ...(isUnreachable ? { lastError: message } : { lastError: null }), ...(isUnreachable ? {} : { lastSync: new Date() }) },
    });

    return { success: false, message: `Sync failed: ${message}`, logsImported: 0 };
  }
}

export async function testDeviceConnection(device: IDevice): Promise<{ online: boolean; latency?: number; message: string }> {
  const base = `http://${device.ip}:${device.port}`;
  const start = Date.now();

  // Try lightweight probes — cdata is the standard eSSL iClock endpoint (confirmed 200)
  const probeUrls = [
    `${base}/iclock/cdata?SN=${device.serialNumber}&stamp=9999999999&command_id=0`,
    `${base}/iclock/`,
    `${base}/`,
  ];

  for (const url of probeUrls) {
    try {
      const res = await axios.get(url, {
        timeout: 5000,
        validateStatus: () => true, // any HTTP response means device is reachable
      });
      const latency = Date.now() - start;
      const statusNote = res.status === 200 ? '' : ` (HTTP ${res.status} — check device URL path)`;
      await prisma.device.update({ where: { id: device.id ?? String(device._id) }, data: { status: 'Online', lastError: null } });
      return { online: true, latency, message: `Device reachable in ${latency}ms${statusNote}` };
    } catch (err) {
      if (isNetworkError(err)) break;
      const latency = Date.now() - start;
      await prisma.device.update({ where: { id: device.id ?? String(device._id) }, data: { status: 'Online', lastError: null } });
      return { online: true, latency, message: `Device reachable in ${latency}ms (HTTP error on probe — check device path)` };
    }
  }

  const latency = Date.now() - start;
  await prisma.device.update({ where: { id: device.id ?? String(device._id) }, data: { status: 'Offline' } });
  return { online: false, latency, message: `Device unreachable at ${device.ip}:${device.port} — check IP/port and network connectivity` };
}

export async function syncAllActiveDevices(): Promise<void> {
  // Skip devices using ETL auto-sync — their cron is handled separately in cronService
  const devices = await prisma.device.findMany({ where: { isActive: true, autoSync: { not: true } } });
  if (devices.length === 0) {
    console.log('[eSSL] No iClock-pull devices to sync (all use ETL auto-sync)');
    return;
  }
  console.log(`[eSSL] Syncing ${devices.length} iClock-pull device(s)...`);
  await Promise.allSettled(devices.map((d) => syncDevice(d)));
}
