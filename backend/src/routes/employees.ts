import { Router, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { authenticateJWT, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticateJWT);

// ─── GET /api/employees ──────────────────────────────────────────────────────
router.get('/', requireRole(['Admin', 'HR']), [
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

    const where: { isActive?: boolean; department?: string; OR?: any[] } = {};
    if (statusFilter === 'active') where.isActive = true;
    else if (statusFilter === 'inactive') where.isActive = false;
    if (department) where.department = department;
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, role: true, department: true } } },
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({ data: employees, total, page, limit, pages: Math.ceil(total / limit) });
  }
);

// ─── GET /api/employees/departments ─────────────────────────────────────────
router.get('/departments', requireRole(['Admin', 'HR']), async (_req, res: Response): Promise<void> => {
  const rows = await prisma.employee.findMany({ select: { department: true }, distinct: ['department'], orderBy: { department: 'asc' } });
  res.json(rows.map((r) => r.department));
});

// ─── GET /api/employees/profile ──────────────────────────────────────────────
router.get('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  const employee = await prisma.employee.findFirst({
    where: { userId: req.user!.id },
    include: { user: { select: { id: true, name: true, email: true, role: true, department: true } } },
  });
  if (!employee) { res.status(404).json({ message: 'Employee profile not found' }); return; }
  res.json(employee);
});

// ─── GET /api/employees/:id ──────────────────────────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, name: true, email: true, role: true, department: true } } },
  });
  if (!employee) { res.status(404).json({ message: 'Employee not found' }); return; }
  if (req.user?.role === 'Employee') {
    const own = await prisma.employee.findFirst({ where: { userId: req.user.id } });
    if (own?.id !== req.params.id) { res.status(403).json({ message: 'Insufficient permissions' }); return; }
  }
  res.json(employee);
});

// ─── POST /api/employees ─────────────────────────────────────────────────────
router.post('/', requireRole(['Admin', 'HR']), [
    body('name').trim().notEmpty(), body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }), body('employeeId').trim().notEmpty(),
    body('department').trim().notEmpty(), body('designation').trim().notEmpty(),
    body('joinDate').isISO8601(),
    body('role').optional().isIn(['Admin', 'HR', 'Manager', 'Employee']),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    const { name, email, password, role = 'Employee', employeeId, department, designation, joinDate, shiftId, phone } = req.body as {
      name: string; email: string; password: string; role?: string;
      employeeId: string; department: string; designation: string;
      joinDate: string; shiftId?: string; phone?: string;
    };

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) { res.status(409).json({ message: 'Email already registered' }); return; }
    const existingEmp = await prisma.employee.findUnique({ where: { employeeId } });
    if (existingEmp) { res.status(409).json({ message: 'Employee ID already exists' }); return; }

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: role as 'Admin' | 'HR' | 'Manager' | 'Employee', department, isEmailVerified: true },
    });
    const employee = await prisma.employee.create({
      data: { userId: user.id, employeeId, department, designation, ...(shiftId && { shiftId }), joinDate: new Date(joinDate), phone },
    });
    res.status(201).json({ user: { id: user.id, name, email, role }, employee });
  }
);

// ─── PUT /api/employees/:id ──────────────────────────────────────────────────
router.put('/:id', requireRole(['Admin', 'HR']), async (req: AuthRequest, res: Response): Promise<void> => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!employee) { res.status(404).json({ message: 'Employee not found' }); return; }

  const { name, department, designation, shiftId, phone, address, emergencyContact, joinDate, role, isActive } = req.body as {
    name?: string; department?: string; designation?: string; shiftId?: string | null;
    phone?: string; address?: string; emergencyContact?: string; joinDate?: string; role?: string; isActive?: boolean;
  };

  if (name || department || role) {
    await prisma.user.update({
      where: { id: employee.userId },
      data: { ...(name && { name }), ...(department && { department }), ...(role && { role: role as 'Admin' | 'HR' | 'Manager' | 'Employee' }) },
    });
  }
  await prisma.employee.update({
    where: { id: req.params.id },
    data: {
      ...(department && { department }), ...(designation && { designation }),
      ...(shiftId !== undefined && { shiftId: shiftId || null }),
      ...(phone !== undefined && { phone }), ...(address !== undefined && { address }),
      ...(emergencyContact !== undefined && { emergencyContact }),
      ...(joinDate && { joinDate: new Date(joinDate) }),
      ...(isActive !== undefined && { isActive }),
    },
  });
  res.json({ message: 'Employee updated' });
});

// ─── DELETE /api/employees/:id — soft delete ─────────────────────────────────
router.delete('/:id', requireRole(['Admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!employee) { res.status(404).json({ message: 'Employee not found' }); return; }
  await prisma.employee.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ message: 'Employee deactivated' });
});

export default router;
