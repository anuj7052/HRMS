import cron from 'node-cron';
import { syncAllActiveDevices, processAttendanceFromRaw } from './esslService';
import { fetchFromIClockServerDirect, decryptFromStorage } from './etlService';
import { prisma } from '../lib/prisma';

export function startCronJobs(): void {
  // Every 15 minutes: sync all active eSSL devices (iClock pull)
  cron.schedule('*/15 * * * *', async () => {
    console.log('[Cron] Running eSSL device sync...');
    await syncAllActiveDevices();
  });

  // Every minute: check which devices need an auto-sync from the eTimeTrackLite server
  cron.schedule('* * * * *', async () => {
    try {
      const devices = await prisma.device.findMany({ where: { autoSync: true, isActive: true } });
      const now = Date.now();

      for (const device of devices) {
        const intervalMs = (device.syncInterval ?? 5) * 60 * 1000;
        const lastSync = device.lastEtlSync ? device.lastEtlSync.getTime() : 0;
        if (now - lastSync < intervalMs) continue; // not due yet

        // Run async so we don't block other devices
        (async () => {
          try {
            let password: string | undefined;
            if (device.etlPassword) {
              try { password = decryptFromStorage(device.etlPassword); } catch { /* bad creds */ }
            }
            const baseUrl = `http://${device.ip}:${device.port}`;

            console.log(`[AutoSync] ${device.name}: fetching from ${baseUrl} since ${device.lastEtlSync?.toISOString() ?? 'beginning of month'}`);
            const result = await fetchFromIClockServerDirect(
              baseUrl,
              device.serialNumber,
              device.lastEtlSync ?? undefined,
              device.etlUsername ?? undefined,
              password,
            );

            let newLogs = 0;
            for (const rec of result.records) {
              try {
                await prisma.rawPunchLog.create({
                  data: { deviceId: device.id, employeeDeviceId: rec.employeeDeviceId, timestamp: rec.timestamp, punchType: rec.punchType, raw: rec.raw },
                });
                newLogs++;
              } catch { /* duplicate */ }
            }

            if (newLogs > 0) {
              await processAttendanceFromRaw(device.id);
            }

            // Only advance lastEtlSync when we actually succeeded (got records OR login+no-data)
            // Don't advance on authentication failures to avoid skipping historical data
            if (result.success) {
              await prisma.device.update({
                where: { id: device.id },
                data: { lastEtlSync: new Date(), status: 'Online', lastSync: new Date(), lastError: null },
              });
            } else {
              await prisma.device.update({
                where: { id: device.id },
                data: { status: 'Online', lastError: result.message },
              });
            }

            if (newLogs > 0) {
              console.log(`[AutoSync] ${device.name}: ${newLogs} new records processed`);
            } else if (!result.success) {
              console.warn(`[AutoSync] ${device.name}: sync failed — ${result.message}`);
            }
          } catch (e) {
            console.error(`[AutoSync] ${device.name} failed:`, (e as Error).message);
            await prisma.device.update({
              where: { id: device.id },
              data: { status: 'Offline', lastError: (e as Error).message },
            });
          }
        })();
      }
    } catch (e) {
      console.error('[AutoSync] Cron tick error:', (e as Error).message);
    }
  });

  console.log('[Cron] Jobs scheduled: eSSL sync every 15 min, ETL auto-sync every minute (per device interval)');
}
