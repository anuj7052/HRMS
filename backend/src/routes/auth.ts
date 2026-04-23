import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../services/emailService';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

function generateAccessToken(id: string, email: string, role: string): string {
  return jwt.sign({ id, email, role }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
  } as jwt.SignOptions);
}

function generateRefreshToken(id: string): string {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  } as jwt.SignOptions);
}

async function getAllowedDomains(): Promise<string[]> {
  // Read from env var; no DB dependency
  const envDomains = process.env.ALLOWED_EMAIL_DOMAINS || '';
  return envDomains.split(',').map((d) => d.trim()).filter(Boolean);
}

function isDomainAllowed(email: string, allowed: string[]): boolean {
  if (!allowed.length) return true; // no restriction configured
  const domain = email.split('@')[1]?.toLowerCase();
  return allowed.some((d) => d.toLowerCase() === domain);
}

// ─── POST /api/auth/register ────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .matches(/[A-Z]/)
      .matches(/[0-9]/)
      .withMessage('Password must be ≥8 chars with uppercase and number'),
    body('role').optional().isIn(['Admin', 'HR', 'Employee']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, email, password, role = 'Employee', department } = req.body as {
      name: string;
      email: string;
      password: string;
      role?: string;
      department?: string;
    };

    const allowedDomains = await getAllowedDomains();
    if (!isDomainAllowed(email, allowedDomains)) {
      res.status(400).json({ message: `Registration is restricted to company email domains: ${allowedDomains.join(', ')}` });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: (role as any) || 'Employee',
        department,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
    });

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
    try {
      await sendEmail({
        to: email,
        subject: 'Verify your HRMS account',
        html: `<p>Hi ${name},</p><p>Please verify your email: <a href="${verifyUrl}">Click here</a></p><p>Link expires in 24 hours.</p>`,
      });
    } catch (emailErr) {
      console.warn('[Auth] Email send failed (non-fatal):', (emailErr as Error).message);
    }

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    });
  }
);

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
router.post(
  '/verify-email',
  [body('token').notEmpty().withMessage('Token required')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { token } = req.body as { token: string };
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired verification token' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    res.json({ message: 'Email verified successfully. You can now log in.' });
  }
);

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!user.isEmailVerified) {
      res.status(403).json({ message: 'Please verify your email before logging in' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    res
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth/refresh',
      })
      .json({
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
        },
      });
  }
);

// ─── POST /api/auth/microsoft ───────────────────────────────────────────────
// Verifies a Microsoft (Azure AD) ID token and signs the user in (creates if new).
const MS_TENANT = process.env.AZURE_AD_TENANT_ID || 'common';
const MS_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID || '';
const msJwks = MS_CLIENT_ID
  ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${MS_TENANT}/discovery/v2.0/keys`))
  : null;

router.post('/microsoft', async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      res.status(400).json({ message: 'idToken required' });
      return;
    }
    if (!MS_CLIENT_ID || !msJwks) {
      res.status(500).json({ message: 'Microsoft login not configured on server (AZURE_AD_CLIENT_ID missing)' });
      return;
    }

    const issuers = [
      `https://login.microsoftonline.com/${MS_TENANT}/v2.0`,
      `https://sts.windows.net/${MS_TENANT}/`,
    ];

    const { payload } = await jwtVerify(idToken, msJwks, {
      audience: MS_CLIENT_ID,
      issuer: issuers,
    });

    const email = (payload.email || payload.preferred_username || payload.upn) as string | undefined;
    const name = (payload.name as string | undefined) || (email ? email.split('@')[0] : 'User');

    if (!email) {
      res.status(400).json({ message: 'Microsoft token did not contain an email/UPN' });
      return;
    }

    const lowerEmail = email.toLowerCase().trim();
    const allowedDomains = await getAllowedDomains();
    if (!isDomainAllowed(lowerEmail, allowedDomains)) {
      res.status(403).json({ message: `Email domain not allowed. Allowed: ${allowedDomains.join(', ')}` });
      return;
    }

    let user = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (!user) {
      // Auto-provision: create a new Employee. Random password (user can reset later).
      const randomPass = crypto.randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPass, BCRYPT_ROUNDS);
      user = await prisma.user.create({
        data: {
          name,
          email: lowerEmail,
          passwordHash,
          role: 'Employee',
          isEmailVerified: true,
        },
      });
    } else if (!user.isEmailVerified) {
      await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true } });
    }

    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    res
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth/refresh',
      })
      .json({
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
        },
      });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Microsoft sign-in failed';
    res.status(401).json({ message: `Microsoft sign-in failed: ${msg}` });
  }
});
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) {
    res.status(401).json({ message: 'Refresh token missing' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.refreshToken !== token) {
      res.status(401).json({ message: 'Invalid refresh token' });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.email, user.role);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user?.id) {
    await prisma.user.update({ where: { id: req.user.id }, data: { refreshToken: null } }).catch(() => {});
  }
  res
    .clearCookie('refreshToken', { path: '/api/auth/refresh' })
    .json({ message: 'Logged out successfully' });
});

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as { email: string };
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond success to prevent user enumeration
    if (!user) {
      res.json({ message: 'If that email exists, a reset link has been sent.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1h
      },
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    try {
      await sendEmail({
        to: email,
        subject: 'HRMS Password Reset',
        html: `<p>Reset your password: <a href="${resetUrl}">Click here</a></p><p>Link expires in 1 hour.</p>`,
      });
    } catch (emailErr) {
      console.warn('[Auth] Reset email failed (non-fatal):', (emailErr as Error).message);
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  }
);

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password')
      .isLength({ min: 8 })
      .matches(/[A-Z]/)
      .matches(/[0-9]/)
      .withMessage('Password must be ≥8 chars with uppercase and number'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { token, password } = req.body as { token: string; password: string };
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired reset token' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        passwordResetToken: null,
        passwordResetExpiry: null,
        refreshToken: null,
      },
    });

    res.json({ message: 'Password reset successful. Please log in.' });
  }
);

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.user?.id } });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    isEmailVerified: user.isEmailVerified,
  });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post(
  '/change-password',
  authenticateJWT,
  [
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/[A-Z]/)
      .matches(/[0-9]/)
      .withMessage('Password must be ≥8 chars with uppercase and number'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    const user = await prisma.user.findUnique({ where: { id: req.user?.id } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    });
    res.json({ message: 'Password updated successfully' });
  }
);

export default router;
