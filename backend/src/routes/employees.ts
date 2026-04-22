import { Router, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Employee } from '../models/Employee';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

// ─── GET /api/employees ──────────────────────────────────────────────────────
router.get(
  '/',
  requireRole(['Admin', 'HR']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString(),
    query('department').optional().isString(),
    query('status').optional().isIn(['active', 'inactive', 'all']),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '20');
    const search = (req.query.search as string) || '';
    const department = (req.query.department as string) || '';
    const statusFilter = (req.query.status as string) || 'active';

    const userFilter: Record<string, unknown> = {};
    if (search) {
      userFilter['$or'] = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const matchingUsers = search
      ? await User.find(userFilter).select('_id').lean()
      : null;

    const empFilter: Record<string, unknown> = {};
    // Status filter: active (default) | inactive | all
    if (statusFilter === 'active') empFilter.isActive = true;
    else if (statusFilter === 'inactive') empFilter.isActive = false;
    // 'all' → no isActive filter
    if (department) empFilter.department = department;
    if (matchingUsers) {
      empFilter.$or = [
        { userId: { $in: matchingUsers.map((u) => u._id) } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Employee.countDocuments(empFilter);
    const employees = await Employee.find(empFilter)
      .populate('userId', 'name email role')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: employees, total, page, limit, pages: Math.ceil(total / limit) });
  }
);

// ─── GET /api/employees/departments ─────────────────────────────────────────
router.get('/departments', requireRole(['Admin', 'HR']), async (_req, res: Response): Promise<void> => {
  const departments = await Employee.distinct('department');
  res.json(departments.sort());
});

// ─── GET /api/employees/profile ──────────────────────────────────────────────
// Returns the authenticated user's own employee record (all roles)
router.get('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  const employee = await Employee.findOne({ userId: req.user!.id })
    .populate('userId', 'name email role department')
    .lean();
  if (!employee) {
    res.status(404).json({ message: 'Employee profile not found' });
    return;
  }
  res.json(employee);
});

// ─── GET /api/employees/:id ──────────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const employee = await Employee.findById(req.params.id)
    .populate('userId', 'name email role department')
    .lean();
  if (!employee) {
    res.status(404).json({ message: 'Employee not found' });
    return;
  }
  // Employees can only see their own record
  if (req.user?.role === 'Employee') {
    const emp = await Employee.findOne({ userId: req.user.id });
    if (String(emp?._id) !== req.params.id) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }
  }
  res.json(employee);
});

// ─── POST /api/employees ─────────────────────────────────────────────────────
router.post(
  '/',
  requireRole(['Admin', 'HR']),
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('employeeId').trim().notEmpty(),
    body('department').trim().notEmpty(),
    body('designation').trim().notEmpty(),
    body('joinDate').isISO8601(),
    body('role').optional().isIn(['Admin', 'HR', 'Employee']),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, email, password, role = 'Employee', employeeId, department, designation, joinDate, shift, shiftId, phone } = req.body as {
      name: string; email: string; password: string; role?: string;
      employeeId: string; department: string; designation: string;
      joinDate: string; shift?: string; shiftId?: string; phone?: string;
    };

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }
    const existingEmp = await Employee.findOne({ employeeId });
    if (existingEmp) {
      res.status(409).json({ message: 'Employee ID already exists' });
      return;
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

    const user = await User.create({ name, email, passwordHash, role, department, isEmailVerified: true });
    const employee = await Employee.create({
      userId: user._id,
      employeeId,
      department,
      designation,
      shift: shift || 'General',
      ...(shiftId && { shiftId }),
      joinDate: new Date(joinDate),
      phone,
    });

    res.status(201).json({ user: { id: user._id, name, email, role }, employee });
  }
);

// ─── PUT /api/employees/:id ──────────────────────────────────────────────────
router.put(
  '/:id',
  requireRole(['Admin', 'HR']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const employee = await Employee.findById(req.params.id).populate('userId');
    if (!employee) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }

    const { name, department, designation, shift, shiftId, phone, address, emergencyContact, joinDate, role } = req.body as {
      name?: string; department?: string; designation?: string; shift?: string; shiftId?: string | null;
      phone?: string; address?: string; emergencyContact?: string; joinDate?: string; role?: string;
    };

    // Update user fields
    if (name || department || role) {
      await User.findByIdAndUpdate(employee.userId, {
        ...(name && { name }),
        ...(department && { department }),
        ...(role && { role }),
      });
    }

    // Update employee fields
    Object.assign(employee, {
      ...(department && { department }),
      ...(designation && { designation }),
      ...(shift && { shift }),
      ...(shiftId !== undefined && { shiftId: shiftId || null }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(emergencyContact !== undefined && { emergencyContact }),
      ...(joinDate && { joinDate: new Date(joinDate) }),
    });

    await employee.save();
    res.json({ message: 'Employee updated', employee });
  }
);

// ─── DELETE /api/employees/:id ───────────────────────────────────────────────
router.delete(
  '/:id',
  requireRole(['Admin']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }
    // Soft delete
    employee.isActive = false;
    await employee.save();
    res.json({ message: 'Employee deactivated' });
  }
);

export default router;
