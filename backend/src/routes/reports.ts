import { Router, Response } from 'express';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticateJWT, requireRole(['Admin', 'HR']));

// ─── GET /api/reports/monthly ────────────────────────────────────────────────
router.get('/monthly', async (req: AuthRequest, res: Response): Promise<void> => {
  const month = parseInt((req.query.month as string) || String(new Date().getMonth() + 1));
  const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
  const department = (req.query.department as string) || '';

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const employees = await prisma.employee.findMany({
    where: { isActive: true, ...(department && { department }) },
    include: { user: { select: { name: true, email: true } } },
  });
  const logs = await prisma.attendanceLog.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) }, date: { gte: start, lt: end } },
  });

  const summary = employees.map((emp) => {
    const empLogs = logs.filter((l) => l.employeeId === emp.id);
    return {
      employeeId: emp.employeeId, name: emp.user?.name || '', department: emp.department,
      present: empLogs.filter((l) => l.status === 'Present').length,
      late: empLogs.filter((l) => l.status === 'Late').length,
      absent: empLogs.filter((l) => l.status === 'Absent').length,
      leave: empLogs.filter((l) => l.status === 'Leave').length,
      totalWorkHours: empLogs.reduce((sum, l) => sum + (l.workHours || 0), 0).toFixed(2),
    };
  });

  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const dailyBreakdown = Array.from({ length: days }, (_, i) => {
    const date = new Date(start); date.setDate(date.getDate() + i);
    const dayStr = date.toISOString().split('T')[0];
    const dayLogs = logs.filter((l) => l.date.toISOString().split('T')[0] === dayStr);
    return { date: dayStr, present: dayLogs.filter((l) => l.status === 'Present').length, late: dayLogs.filter((l) => l.status === 'Late').length, absent: dayLogs.filter((l) => l.status === 'Absent').length };
  });

  res.json({ summary, dailyBreakdown, month, year, department });
});

// ─── GET /api/reports/export/csv ────────────────────────────────────────────
router.get('/export/csv', async (req: AuthRequest, res: Response): Promise<void> => {
  const month = parseInt((req.query.month as string) || String(new Date().getMonth() + 1));
  const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const employees = await prisma.employee.findMany({ where: { isActive: true }, include: { user: { select: { name: true } } } });
  const logs = await prisma.attendanceLog.findMany({ where: { date: { gte: start, lt: end } } });

  const rows = employees.map((emp) => {
    const empLogs = logs.filter((l) => l.employeeId === emp.id);
    return {
      'Employee ID': emp.employeeId, Name: emp.user?.name || '', Department: emp.department,
      Present: empLogs.filter((l) => l.status === 'Present').length, Late: empLogs.filter((l) => l.status === 'Late').length,
      Absent: empLogs.filter((l) => l.status === 'Absent').length, Leave: empLogs.filter((l) => l.status === 'Leave').length,
      'Total Work Hours': empLogs.reduce((s, l) => s + (l.workHours || 0), 0).toFixed(2),
    };
  });

  const { Parser } = await import('json2csv');
  const parser = new Parser();
  const csv = parser.parse(rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_${year}_${month}.csv"`);
  res.send(csv);
});

// ─── GET /api/reports/export/pdf ────────────────────────────────────────────
router.get('/export/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  const month = parseInt((req.query.month as string) || String(new Date().getMonth() + 1));
  const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const employees = await prisma.employee.findMany({ where: { isActive: true }, include: { user: { select: { name: true } } } });
  const logs = await prisma.attendanceLog.findMany({ where: { date: { gte: start, lt: end } } });
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_${year}_${month}.pdf"`);
  doc.pipe(res);
  doc.fontSize(18).text(`Attendance Report — ${monthName} ${year}`, { align: 'center' });
  doc.moveDown();
  employees.forEach((emp) => {
    const empLogs = logs.filter((l) => l.employeeId === emp.id);
    doc.fontSize(11).text(`${emp.employeeId} | ${emp.user?.name || 'Unknown'} | ${emp.department} | Present: ${empLogs.filter((l) => l.status === 'Present').length} | Late: ${empLogs.filter((l) => l.status === 'Late').length} | Absent: ${empLogs.filter((l) => l.status === 'Absent').length}`);
  });

  doc.end();
});

export default router;
