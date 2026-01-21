import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include session user
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      name: string;
      role: 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen';
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
export function requireRole(...allowedRoles: Array<'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen'>) {
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

/**
 * Result type for business unit validation
 */
export interface BusinessUnitValidationResult {
  businessUnitId: string | null;
  error?: { status: number; message: string };
}

/**
 * Options for business unit validation
 */
export interface BusinessUnitValidationOptions {
  /** Accept businessUnitId from request body (default: true) */
  allowBody?: boolean;
  /** Accept businessUnitId from query parameters (default: true) */
  allowQuery?: boolean;
  /** Fallback to user's businessUnitId if not provided (default: false) */
  fallbackToUserBusinessUnit?: boolean;
}

/**
 * Validates and returns the scoped businessUnitId from the request.
 * Centralizes the repetitive business unit validation logic.
 *
 * Behavior:
 * - Owners can access any business unit
 * - Other roles can only access their assigned business unit
 * - Returns null with error if validation fails
 *
 * @param req Express request object (must have user attached via isAuthenticated)
 * @param options Configuration options for validation
 * @returns BusinessUnitValidationResult with businessUnitId or error
 */
export function validateBusinessUnitAccess(
  req: Request,
  options: BusinessUnitValidationOptions = {}
): BusinessUnitValidationResult {
  const {
    allowBody = true,
    allowQuery = true,
    fallbackToUserBusinessUnit = false,
  } = options;

  // Extract businessUnitId from allowed sources
  let businessUnitId: string | undefined;

  if (allowBody && typeof req.body?.businessUnitId === 'string' && req.body.businessUnitId) {
    businessUnitId = req.body.businessUnitId;
  }

  if (!businessUnitId && allowQuery && typeof req.query?.businessUnitId === 'string' && req.query.businessUnitId) {
    businessUnitId = req.query.businessUnitId;
  }

  // Fallback to user's business unit if enabled
  if (!businessUnitId && fallbackToUserBusinessUnit && req.user?.businessUnitId) {
    businessUnitId = req.user.businessUnitId;
  }

  // Require businessUnitId
  if (!businessUnitId) {
    return {
      businessUnitId: null,
      error: { status: 400, message: 'businessUnitId is required' }
    };
  }

  // Owners can access any business unit
  const userRole = req.user?.role;
  if (userRole === 'owner') {
    return { businessUnitId };
  }

  // Other roles must have an assigned business unit
  const userBusinessUnitId = req.user?.businessUnitId;
  if (!userBusinessUnitId) {
    return {
      businessUnitId: null,
      error: { status: 403, message: 'User has no assigned business unit' }
    };
  }

  // Validate that requested business unit matches user's assigned unit
  if (businessUnitId !== userBusinessUnitId) {
    return {
      businessUnitId: null,
      error: { status: 403, message: 'Business unit mismatch' }
    };
  }

  return { businessUnitId };
}

/**
 * Middleware that validates business unit access and attaches businessUnitId to request.
 * Use this middleware after isAuthenticated to ensure business unit scoping.
 *
 * On success: Sets req.businessUnitId and calls next()
 * On failure: Sends appropriate error response
 */
export function requireBusinessUnit(options: BusinessUnitValidationOptions = {}) {
  return (req: Request & { businessUnitId?: string }, res: Response, next: NextFunction) => {
    const result = validateBusinessUnitAccess(req, options);

    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    // Attach businessUnitId to request for use in route handlers
    req.businessUnitId = result.businessUnitId!;
    next();
  };
}

// Re-export validation helper for inline use in routes
export { validateBusinessUnitAccess as getValidatedBusinessUnitId };
