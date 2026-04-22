/**
 * iClock Push Receiver
 *
 * Configure your biometric device's "Server URL" to:
 *   http://<your-server-host>:5000
 *
 * The device will then POST attendance logs directly to this HRMS server
 * instead of (or in addition to) eTimeTrackLite.
 *
 * Protocol reference: ADMS / iClock HTTP push protocol (ZKTeco/eSSL)
 */
import { Router, Request, Response } from 'express';
import { Device } from '../models/Device';
import { processAttendanceFromRaw } from '../services/esslService';
import { prisma } from '../lib/prisma';
import { io } from '../server';

const router = Router();

// Larger body limit for bulk log uploads
router.use((req, _res, next) => {
  require('express').raw({ type: 'text/plain', limit: '5mb' })(req, _res, next);
});

// ─── GET /iclock/cdata ────────────────────────────────────────────────────────
// Device initial handshake — responds with server config
router.get('/cdata', async (req: Request, res: Response): Promise<void> => {
  const sn = (req.query.SN || req.query.sn || '') as string;
  console.log(`[iClock] GET handshake from device SN=${sn}`);

  if (!sn) {
    res.status(400).send('SN required');
    return;
  }

  // Mark device as Online
  await Device.findOneAndUpdate(
    { serialNumber: sn },
    { status: 'Online', lastError: undefined },
    { new: false }
  );

  // Respond with iClock server config — device uses these settings
  const now = Math.floor(Date.now() / 1000);
  res.set('Content-Type', 'text/plain');
  res.send([
    `GET OPTION FROM: ${sn}`,
    `ATTLOGStamp=None`,
    `OPERLOGStamp=9999`,
    `ATTPHOTOStamp=None`,
    `ErrorDelay=60`,
    `Delay=10`,
    `TransTimes=00:00;23:59`,
    `TransInterval=1`,
    `TransFlag=TransData AttLog OpLog`,
    `TimeZone=330`,
    `Realtime=1`,
    `Encrypt=0`,
    `ServerVer=2.4.1`,
    `PushProtVer=2.4.1`,
    `PushOptionsFlag=1`,
    `SyncTime=${now}`,
  ].join('\r\n'));
});

// ─── POST /iclock/cdata ───────────────────────────────────────────────────────
// Device pushes attendance logs here
router.post('/cdata', async (req: Request, res: Response): Promise<void> => {
  const sn = (req.query.SN || req.query.sn || '') as string;
  const table = (req.query.table || '') as string;
  const stamp = req.query.Stamp || req.query.stamp;

  const rawBody = req.body
    ? typeof req.body === 'string'
      ? req.body
      : Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : String(req.body)
    : '';

  console.log(`[iClock] POST from SN=${sn} table=${table} stamp=${stamp} bytes=${rawBody.length}`);

  if (!sn) {
    res.send('OK');
    return;
  }

  // Find device in DB
  const device = await Device.findOne({ serialNumber: sn });

  if (table.toUpperCase() === 'ATTLOG' && rawBody.trim()) {
    await handleAttLogPush(sn, rawBody, device?._id?.toString());
  } else if (table.toUpperCase() === 'OPERLOG') {
    console.log(`[iClock] OPERLOG from ${sn} (${rawBody.length} bytes) — stored for audit`);
  }

  if (device) {
    await Device.findByIdAndUpdate(device._id, {
      status: 'Online',
      lastSync: new Date(),
      lastError: undefined,
    });
  }

  res.set('Content-Type', 'text/plain');
  res.send('OK');
});

// ─── GET /iclock/getrequest ───────────────────────────────────────────────────
// Device polls for pending commands
router.get('/getrequest', async (req: Request, res: Response): Promise<void> => {
  const sn = (req.query.SN || req.query.sn || '') as string;
  console.log(`[iClock] GET getrequest from SN=${sn}`);
  res.set('Content-Type', 'text/plain');
  res.send('OK');
});

// ─── POST /iclock/devicecmd ───────────────────────────────────────────────────
// Device confirms command execution
router.post('/devicecmd', async (req: Request, res: Response): Promise<void> => {
  const sn = (req.query.SN || req.query.sn || '') as string;
  console.log(`[iClock] POST devicecmd from SN=${sn}`);
  res.set('Content-Type', 'text/plain');
  res.send('OK');
});

// ─── GET /iclock/devicecmd ────────────────────────────────────────────────────
router.get('/devicecmd', async (req: Request, res: Response): Promise<void> => {
  res.set('Content-Type', 'text/plain');
  res.send('OK');
});

// ─────────────────────────────────────────────────────────────────────────────

async function handleAttLogPush(sn: string, body: string, deviceId?: string): Promise<void> {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  let newLogs = 0;

  for (const line of lines) {
    // iClock ATTLOG format: PIN\tDate Time\tVerifyType\tPunchType\tWorkCode\tReserved
    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const pin = parts[0]?.trim();
    const dateTime = parts[1]?.trim();
    if (!pin || !dateTime) continue;

    const timestamp = new Date(dateTime.replace(' ', 'T'));
    if (isNaN(timestamp.getTime())) continue;

    const punchType = parseInt(parts[3] || '0') || 0;

    try {
      await prisma.rawPunchLog.create({
        data: {
          deviceId: deviceId || '',
          employeeDeviceId: pin,
          timestamp,
          punchType,
          raw: line,
        },
      });
      newLogs++;
    } catch {
      // Duplicate — skip
    }
  }

  console.log(`[iClock] SN=${sn}: stored ${newLogs}/${lines.length} new punch records`);

  if (newLogs > 0 && deviceId) {
    // Process into attendance logs asynchronously
    processAttendanceFromRaw(deviceId).then(() => {
      io.emit('attendance:update', { deviceId, synced: newLogs });
    }).catch(e => console.error('[iClock] Process error:', e));
  }
}

export default router;
