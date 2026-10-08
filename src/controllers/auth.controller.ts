import { Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client'; // Import UserRole enum directly from Prisma
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const prisma = new PrismaClient();

// 🛠️ FIXED: Updated target pointer to match your active VITE-prefixed .env naming configuration
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const generateToken = (userId: string, role: string, email: string): string => {
  return jwt.sign({ userId, role, email }, JWT_SECRET, { expiresIn: '24h' });
};

/**
 * 0. ACCOUNT DISCOVERY (SPLIT-STEP AUTH)
 */
export const discoverUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true } // 🔥 Optimization: Only pull the ID to keep performance ultra-fast
    });

    res.status(200).json({
      exists: !!user // Returns true if user exists, false if they don't
    });
  } catch (error) {
    console.error('❌ Discovery Error:', error);
    res.status(500).json({ error: 'Internal server error during account discovery.' });
  }
};

/**
 * 1. MANUAL REGISTRATION
 */
export const registerManual = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      res.status(400).json({ error: 'All fields are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: fullName.trim(),
        passwordHash,
        role: UserRole.CONTRIBUTOR_QS
      }
    });

    const token = generateToken(newUser.id, newUser.role, newUser.email);

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: { id: newUser.id, fullName: newUser.name, email: newUser.email, role: newUser.role }
    });
  } catch (error) {
    console.error('❌ Registration Error:', error); // Enhanced debug tracing
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

/**
 * 2. MANUAL LOGIN
 */
export const loginManual = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Access Denied: Invalid credentials.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Access Denied: Invalid credentials.' });
      return;
    }

    const token = generateToken(user.id, user.role, user.email);

    res.status(200).json({
      message: 'Authentication successful.',
      token,
      user: { id: user.id, fullName: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Login Error:', error); // 🛠️ FIXED: Exposed stack traces to the terminal for debugging
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

/**
 * 3. GOOGLE OAUTH / UP-SERT HANDSHAKE
 */
export const authGoogle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ error: 'Google ID token is required.' });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID, // 🛠️ FIXED: Links to the updated reference variable
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: 'Invalid token payload received from Google.' });
      return;
    }

    const { email, name } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name || 'Google User', 
          passwordHash: '', 
          role: UserRole.CONTRIBUTOR_QS
        }
      });
    }

    const token = generateToken(user.id, user.role, user.email);

    res.status(200).json({
      message: 'Google authentication successful.',
      token,
      user: { id: user.id, fullName: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Google Handshake Error:', error); // 🛠️ FIXED: Error logging added for OAuth loop debugging
    res.status(500).json({ error: 'Google authentication handshake failed.' });
  }
};