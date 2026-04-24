import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticateJWT);

// ─── GET /api/leaves/types ───────────────────────────────────────────────────
router.get('/types', async (_req, res: Response): Promise<void> => {
  const types = await prisma.leaveType.findMany({ where: { isActive: true } });
  res.json(types);
});

// ─── POST /api/leaves/types ──────────────────────────────────────────────────
router.post('/types', requireRole(['Admin']),
  [body('name').trim().notEmpty(), body('daysAllowed').isInt({ min: 0 })],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }
    const { name, daysAllowed, description } = req.body as { name: string; daysAllowed: number; description?: string };
    const lt = await prisma.leaveType.create({ data: { name, daysAllowed, description } });
    res.status(201).json(lt);
  }
);

// ─── GET /api/leaves/balance/:employeeId ────────────────────────────────────
router.get('/balance/:employeeId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role === 'Employee') {
    const emp = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!emp || emp.id !== req.params.employeeId) { res.status(403).json({ message: 'Insufficient permissions' }); return; }
  }
  const year = new Date().getFullYear();
  const balances = await prisma.leaveBalance.findMany({
    where: { employeeId: req.params.employeeId, year },
    include: { leaveType: { select: { name: true } } },
  });
  res.json(balances);
});

// ─── GET /api/leaves ─────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.query as { status?: string };
  const where: { employeeId?: string; status?: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' } = {};
  if (req.user?.role === 'Employee') {
    const emp = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!emp) { res.status(404).json({ message: 'Employee profile not found' }); return; }
    where.employeeId = emp.id;
  }
  if (status) where.status = status as 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  const leaves = await prisma.leaveRequest.findMany({
    where,
    include: {
      leaveType: { select: { name: true } },
      employee: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(leaves);
});

// ─── POST /api/leaves ────────────────────────────────────────────────────────
router.post('/', [
    body('leaveTypeId').notEmpty(), body('fromDate').isISO8601(),
    body('toDate').isISO8601(), body('reason').trim().isLength({ min: 5 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const emp = await prisma.employee.findFirst({ where: { userId: req.user?.id } });
    if (!emp) { res.status(404).json({ message: 'Employee profile not found' }); return; }

    const { leaveTypeId, fromDate, toDate, reason } = req.body as {
      leaveTypeId: string; fromDate: string; toDate: string; reason: string;
    };
    const from = new Date(fromDate); const to = new Date(toDate);
    if (from > to) { res.status(400).json({ message: 'fromDate must be before toDate' }); return; }
    const totalDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType) { res.status(404).json({ message: 'Leave type not found' }); return; }

    const year = from.getFullYear();
    let balance = await prisma.leaveBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId, year } } });
    if (!balance) {
      balance = await prisma.leaveBalance.create({
        data: { employeeId: emp.id, leaveTypeId, year, allocated: leaveType.daysAllowed, used: 0, remaining: leaveType.daysAllowed },
      });
    }
    if (balance.remaining < totalDays) {
      res.status(400).json({ message: `Insufficient leave balance. Available: ${balance.remaining} day(s)` }); return;
    }

    const request = await prisma.leaveRequest.create({
      data: { employeeId: emp.id, leaveTypeId, fromDate: from, toDate: to, totalDays, reason },
    });
    res.status(201).json({ message: 'Leave request submitted', request });
  }
);

// ─── PUT /api/leaves/:id/review ──────────────────────────────────────────────
router.put('/:id/review', requireRole(['Admin', 'HR']),
  [body('status').isIn(['Approved', 'Rejected']), body('comment').optional().isString()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!leave) { res.status(404).json({ message: 'Leave request not found' }); return; }
    if (leave.status !== 'Pending') { res.status(400).json({ message: 'Request already reviewed' }); return; }

    const { status, comment } = req.body as { status: 'Approved' | 'Rejected'; comment?: string };

    await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status, reviewedById: req.user?.id, reviewedAt: new Date(), ...(comment && { reviewComment: comment }) },
    });

    if (status === 'Approved') {
      const year = leave.fromDate.getFullYear();
      await prisma.leaveBalance.updateMany({
        where: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year },
        data: { used: { increment: leave.totalDays }, remaining: { decrement: leave.totalDays } },
      });
      const current = new Date(leave.fromDate);
      while (current <= leave.toDate) {
        const date = new Date(current); date.setUTCHours(0, 0, 0, 0);
        await prisma.attendanceLog.upsert({
          where: { employeeId_date: { employeeId: leave.employeeId, date } },
          update: { status: 'Leave' },
          create: { employeeId: leave.employeeId, date, status: 'Leave', source: 'leave' },
        });
        current.setDate(current.getDate() + 1);
      }
    }
    res.json({ message: `Leave ${status}` });
  }
);

// ─── DELETE /api/leaves/:id — cancel pending leave ──────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!leave) { res.status(404).json({ message: 'Leave request not found' }); return; }
  if (req.user?.role === 'Employee') {
    const emp = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (!emp || emp.id !== leave.employeeId) { res.status(403).json({ message: 'Insufficient permissions' }); return; }
  }
  if (leave.status !== 'Pending') { res.status(400).json({ message: 'Can only cancel pending requests' }); return; }
  await prisma.leaveRequest.update({ where: { id: req.params.id }, data: { status: 'Cancelled' } });
  res.json({ message: 'Leave request cancelled' });
});

export default router;
