import dotenv from 'dotenv';
dotenv.config();
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { recordActivity, ActivityType } from '../services/notifier';

const router = Router();
const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);

/**
 * ⚡ NEW: POST /api/auth/discover
 * Performs high-speed profile validation checks for split-step UI rendering flows.
 */
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Account discovery failed: Target email address parameters required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // High performance optimization select query — maps existence without leaking metadata
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true } 
    });

    return res.json({
      exists: !!user
    });

  } catch (error: any) {
    console.error('[ACCOUNT DISCOVERY EXCEPTION]:', error.message);
    return res.status(500).json({ 
      error: 'An unexpected server error occurred during account discovery checks.' 
    });
  }
});

/**
 * POST /api/auth/admin/login
 * Establishes an administrative session via manual credentials.
 */
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    // Fix 2A: accept either 'username' or 'email' as the credential key
    // AuthGateway sends { username, password }; legacy callers may send { email, password }
    const { username, email, password } = req.body;
    // .trim() guards against accidental whitespace in payload or env vars
    const resolvedUsername = (username || email || '').trim();
    const resolvedPassword = (password || '').trim();

    // Static admin credentials — env vars override for deployment flexibility.
    // Default: Username = Admin, Password = Password2026$
    const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'Admin').trim();
    const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'Password2026$').trim();
    const JWT_SECRET = process.env.JWT_SECRET!;

    if (resolvedUsername === ADMIN_USERNAME && resolvedPassword === ADMIN_PASSWORD) {
      let adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
      if (!adminUser) {
        adminUser = await prisma.user.create({
          data: {
            email: ADMIN_USERNAME,
            name: 'System Administrator',
            passwordHash: '',
            role: 'SUPER_ADMIN',
            isActive: true,
            lastLoginAt: new Date()
          }
        });
      } else {
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { lastLoginAt: new Date() }
        });
      }
      console.log(`[ADMIN LOGIN SUCCESS]: Administrative session initiated by "${resolvedUsername}" at ${new Date().toISOString()}`);
      
      // 🔔 Dispatch Telegram push notification and record in ActivityLog
      recordActivity({
        type: ActivityType.ADMIN_LOGIN,
        message: `Administrative session initiated by "${resolvedUsername}"`,
        userId: adminUser.id,
        userEmail: adminUser.email,
        metadata: { role: 'SUPER_ADMIN' },
      });

      const token = jwt.sign({ userId: adminUser.id, role: 'SUPER_ADMIN' }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ 
        token, 
        user: { id: adminUser.id, fullName: adminUser.name, email: adminUser.email, role: adminUser.role } 
      });
    }

    console.warn(`[AUTH ROUTE REJECTION]: Failed authentication attempt for username: "${resolvedUsername}"`);
    return res.status(401).json({ 
      error: 'Authentication failed: Invalid username or password.' 
    });
  } catch (error: any) {
    console.error('[AUTH ROUTE EXCEPTION]:', error.message);
    return res.status(500).json({ 
      error: 'An unexpected server error occurred while processing your authentication.' 
    });
  }
});

/**
 * POST /api/auth/google
 * Validates incoming Google Identity payload credentials.
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    const JWT_SECRET = process.env.JWT_SECRET!;
    const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID!;

    if (!idToken) {
      return res.status(400).json({ error: 'Identity validation failed: Missing target payload token.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ error: 'Google authentication rejected: Unverifiable account profile.' });
    }

    const { email, name } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    let user = await prisma.user.findUnique({ 
      where: { email: normalizedEmail } 
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name || 'Google User',
          passwordHash: '',
          role: UserRole.CONTRIBUTOR_QS, 
          isActive: true,
          lastLoginAt: new Date()
        }
      });
      console.log(`[GOOGLE OAUTH REGISTRATION SUCCESS]: Created new account ledger node for "${normalizedEmail}" at ${new Date().toISOString()}`);
      
      recordActivity({
        type: ActivityType.USER_REGISTER,
        message: `New account registered via Google OAuth: ${name || 'Google User'}`,
        userId: user.id,
        userEmail: user.email,
        metadata: { provider: 'google', name },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
      console.log(`[GOOGLE OAUTH LOGIN SUCCESS]: "${normalizedEmail}" successfully authenticated at ${new Date().toISOString()}`);

      recordActivity({
        type: ActivityType.GOOGLE_LOGIN,
        message: `User logged in via Google OAuth`,
        userId: user.id,
        userEmail: user.email,
        metadata: { provider: 'google', name },
      });
    }

    const localToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    return res.json({
      token: localToken,
      user: {
        id: user.id,
        fullName: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error: any) {
    console.error('[GOOGLE RECOVERY HANDSHAKE EXCEPTION]:', error.message);
    return res.status(401).json({ 
      error: `Google authorization rejected: Cryptographic mismatch or expired payload. Details: ${error.message}` 
    });
  }
});

/**
 * POST /api/auth/register
 * Registers a new Quantity Surveyor contributor with native email/password credentials.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;
    const JWT_SECRET = process.env.JWT_SECRET!;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Registration failed: Missing mandatory account payload parameters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Registration rejected: A user account ledger with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: fullName,
        passwordHash,
        role: UserRole.CONTRIBUTOR_QS, 
        isActive: true,
        lastLoginAt: new Date()
      }
    });

    console.log(`[EMAIL REGISTRATION SUCCESS]: Instantiated new account ledger node for "${normalizedEmail}" at ${new Date().toISOString()}`);

    recordActivity({
      type: ActivityType.USER_REGISTER,
      message: `New contributor registered with email: ${fullName}`,
      userId: newUser.id,
      userEmail: newUser.email,
      metadata: { fullName },
    });

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        fullName: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error: any) {
    console.error('[REGISTRATION EXCEPTION]:', error.message);
    return res.status(500).json({ error: 'An unexpected server error occurred during account provisioning.' });
  }
});

/**
 * POST /api/auth/login
 * Validates traditional email credentials and signs a new 24h runtime context token.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const JWT_SECRET = process.env.JWT_SECRET!;

    if (!email || !password) {
      return res.status(400).json({ error: 'Authentication failed: Missing target credentials.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Authentication failed: Invalid email or password combination.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Authentication failed: Invalid email or password combination.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Access denied: This user account node has been administrative sandboxed.' });
    }

    // 🕒 Record login timestamp in database & stdout for Render logs
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    console.log(`[USER LOGIN SUCCESS]: "${normalizedEmail}" successfully authenticated at ${new Date().toISOString()}`);

    recordActivity({
      type: ActivityType.USER_LOGIN,
      message: `User logged in with email/password`,
      userId: user.id,
      userEmail: user.email,
      metadata: { role: user.role },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('[EMAIL LOGIN EXCEPTION]:', error.message);
    return res.status(500).json({ error: 'An unexpected server error occurred while processing your authentication.' });
  }
});

export { router as authRouter };