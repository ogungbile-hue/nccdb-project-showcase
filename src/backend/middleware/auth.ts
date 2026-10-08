import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: { 
    userId?: string;
    email?: string;
    role: string; 
  };
}

/**
 * 🔒 Inclusive Authentication Guard Middleware
 * Decodes Bearer JWT keys and allows both SUPER_ADMIN and CONTRIBUTOR roles.
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    console.error('[AUTH MIDDLEWARE EXCEPTION]: JWT_SECRET environment variable is unassigned.');
    return res.status(500).json({ 
      error: 'A server configuration error occurred while processing your authorization.' 
    });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`[AUTH MIDDLEWARE REJECTION]: Missing or malformed authorization header from IP: ${req.ip}`);
    return res.status(401).json({ 
      error: 'Authentication failed: Secure session token is missing.' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; email?: string; role: string };
    
    // 🚀 FIXED: Grant passage to SUPER_ADMIN, CONTRIBUTOR_QS, and CONTRIBUTOR roles alike
    if (decoded.role !== 'SUPER_ADMIN' && decoded.role !== 'CONTRIBUTOR_QS' && decoded.role !== 'CONTRIBUTOR') {
      console.warn(`[AUTH MIDDLEWARE REJECTION]: User role "${decoded.role}" lacks structural clearance.`);
      return res.status(403).json({ 
        error: 'Access denied: Insufficient account privileges.' 
      });
    }

    req.user = { 
      userId: decoded.userId || (decoded as any).id,
      email: decoded.email,
      role: decoded.role
    };
    return next();
  } catch (error: any) {
    console.error('[AUTH MIDDLEWARE EXCEPTION]:', error.message);
    return res.status(401).json({ 
      error: 'Authentication failed: Provided session token is invalid or expired.' 
    });
  }
};

/**
 * 🛡️ Role-Based Access Control (RBAC) Guard
 * Extracts the user's role from the verified session context (must be used AFTER requireAdmin or similar authentication check, or handle verification itself).
 * For safety, we will implement full token verification within this middleware to ensure it's self-contained and fails securely.
 */
export const checkRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
      console.error('[RBAC MIDDLEWARE EXCEPTION]: JWT_SECRET environment variable is unassigned.');
      return res.status(500).json({ error: 'A server configuration error occurred while processing your authorization.' });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication failed: Secure session token is missing.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; email?: string; role: string };
      
      if (!allowedRoles.includes(decoded.role)) {
        console.warn(`[RBAC MIDDLEWARE REJECTION]: Access Denied for role "${decoded.role}". Required roles: [${allowedRoles.join(', ')}].`);
        return res.status(403).json({ 
          error: 'Access Denied: Insufficient permissions.' 
        });
      }

      req.user = decoded;
      return next();
    } catch (error: any) {
      console.error('[RBAC MIDDLEWARE EXCEPTION]:', error.message);
      return res.status(401).json({ error: 'Authentication failed: Provided session token is invalid or expired.' });
    }
  };
};