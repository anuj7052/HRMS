import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { LeaveType, LeaveBalance, LeaveRequest } from '../models/Leave';
import { Employee } from '../models/Employee';
import { AttendanceLog } from '../models/AttendanceLog';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// ─── GET /api/leaves/types ───────────────────────────────────────────────────
router.get('/types', async (_req, res: Response): Promise<void> => {
  const types = await LeaveType.find({ isActive: true }).lean();
  res.json(types);
});

// ─── POST /api/leaves/types ──────────────────────────────────────────────────
router.post(
  '/types',
  requireRole(['Admin']),
  [body('name').trim().notEmpty(), body('daysAllowed').isInt({ min: 0 })],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }
    const { name, daysAllowed, description } = req.body as { name: string; daysAllowed: number; description?: string };
    const lt = await LeaveType.create({ name, daysAllowed, description });
    res.status(201).json(lt);
  }
);

// ─── GET /api/leaves/balance/:employeeId ────────────────────────────────────
router.get('/balance/:employeeId', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.role === 'Employee') {
    const emp = await Employee.findOne({ userId: req.user.id });
    if (!emp || String(emp._id) !== req.params.employeeId) {
      res.status(403).json({ message: 'Insufficient permissions' }); return;
    }
  }
  const year = new Date().getFullYear();
  const balances = await LeaveBalance.find({ employeeId: req.params.employeeId, year })
    .populate('leaveTypeId', 'name')
    .lean();
  res.json(balances);
});

// ─── GET /api/leaves ─────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  let filter: Record<string, unknown> = {};
  if (req.user?.role === 'Employee') {
    const emp = await Employee.findOne({ userId: req.user.id });
    if (!emp) { res.status(404).json({ message: 'Employee profile not found' }); return; }
    filter.employeeId = emp._id;
  }
  const { status } = req.query as { status?: string };
  if (status) filter.status = status;

  const leaves = await LeaveRequest.find(filter)
    .populate('leaveTypeId', 'name')
    .populate({ path: 'employeeId', populate: { path: 'userId', select: 'name email' } })
    .sort({ createdAt: -1 })
    .lean();
  res.json(leaves);
});

// ─── POST /api/leaves ────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('leaveTypeId').notEmpty(),
    body('fromDate').isISO8601(),
    body('toDate').isISO8601(),
    body('reason').trim().isLength({ min: 5 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const emp = await Employee.findOne({ userId: req.user?.id });
    if (!emp) { res.status(404).json({ message: 'Employee profile not found' }); return; }

    const { leaveTypeId, fromDate, toDate, reason } = req.body as {
      leaveTypeId: string; fromDate: string; toDate: string; reason: string;
    };

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) { res.status(400).json({ message: 'fromDate must be before toDate' }); return; }

    const diffMs = to.getTime() - from.getTime();
    const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;

    // Check leave balance
    const year = from.getFullYear();
    let balance = await LeaveBalance.findOne({ employeeId: emp._id, leaveTypeId, year });
    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) { res.status(404).json({ message: 'Leave type not found' }); return; }

    if (!balance) {
      balance = await LeaveBalance.create({
        employeeId: emp._id, leaveTypeId, year,
        allocated: leaveType.daysAllowed, used: 0, remaining: leaveType.daysAllowed,
      });
    }

    if (balance.remaining < totalDays) {
      res.status(400).json({ message: `Insufficient leave balance. Available: ${balance.remaining} day(s)` });
      return;
    }

    const request = await LeaveRequest.create({
      employeeId: emp._id, leaveTypeId, fromDate: from, toDate: to, totalDays, reason,
    });

    res.status(201).json({ message: 'Leave request submitted', request });
  }
);

// ─── PUT /api/leaves/:id/review ──────────────────────────────────────────────
router.put(
  '/:id/review',
  requireRole(['Admin', 'HR']),
  [body('status').isIn(['Approved', 'Rejected']), body('comment').optional().isString()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) { res.status(404).json({ message: 'Leave request not found' }); return; }
    if (leave.status !== 'Pending') { res.status(400).json({ message: 'Request already reviewed' }); return; }

    const { status, comment } = req.body as { status: 'Approved' | 'Rejected'; comment?: string };

    leave.status = status;
    leave.reviewedBy = req.user?.id as unknown as typeof leave.reviewedBy;
    leave.reviewedAt = new Date();
    if (comment) leave.reviewComment = comment;
    await leave.save();

    if (status === 'Approved') {
      // Update balance
      const year = leave.fromDate.getFullYear();
      await LeaveBalance.findOneAndUpdate(
        { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year },
        { $inc: { used: leave.totalDays, remaining: -leave.totalDays } }
      );

      // Mark attendance as Leave for date range
      const current = new Date(leave.fromDate);
      while (current <= leave.toDate) {
        const dayStart = new Date(current); dayStart.setHours(0, 0, 0, 0);
        await AttendanceLog.findOneAndUpdate(
          { employeeId: leave.employeeId, date: dayStart },
          { status: 'Leave' },
          { upsert: true, new: true }
        );
        current.setDate(current.getDate() + 1);
      }
    }

    res.json({ message: `Leave ${status}` });
  }
);

// ─── DELETE /api/leaves/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const leave = await LeaveRequest.findById(req.params.id);
  if (!leave) { res.status(404).json({ message: 'Leave request not found' }); return; }

  if (req.user?.role === 'Employee') {
    const emp = await Employee.findOne({ userId: req.user.id });
    if (!emp || String(emp._id) !== String(leave.employeeId)) {
      res.status(403).json({ message: 'Insufficient permissions' }); return;
    }
  }
  if (leave.status !== 'Pending') {
    res.status(400).json({ message: 'Can only cancel pending requests' }); return;
  }

  leave.status = 'Cancelled';
  await leave.save();
  res.json({ message: 'Leave request cancelled' });
});

export default router;
