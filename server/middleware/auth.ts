import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include session user
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      name: string;
      role: 'owner' | 'manager' | 'cashier' | 'kitchen';
      businessUnitId?: string;
    };
  }
}

/**
 * Middleware to check if user is authenticated
 * Returns 401 if no user session exists
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      message: 'Authentication required. Please log in.'
    });
  }

  // Attach user to request object for easy access
  req.user = req.session.user;
  next();
}

/**
 * Middleware factory to check if user has required role
 * Admin (owner) has access to everything
 * Returns 403 if user doesn't have required role
 */
export function requireRole(...allowedRoles: Array<'owner' | 'manager' | 'cashier' | 'kitchen'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required. Please log in.'
      });
    }

    // Owner (admin) has access to everything
    if (req.user.role === 'owner') {
      return next();
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Permission denied. You do not have access to this resource.',
        requiredRole: allowedRoles,
        currentRole: req.user.role
      });
    }

    next();
  };
}

/**
 * Convenience middleware for admin-only routes
 */
export const requireAdmin = requireRole('owner');

/**
 * Convenience middleware for admin or manager routes
 */
export const requireManager = requireRole('owner', 'manager');
