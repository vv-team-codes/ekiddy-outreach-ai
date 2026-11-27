import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import type { UserRole } from '@ekiddy/shared';
import { env } from '../config/env.js';
import { AuditLog, Membership, Organization, User } from '../models/index.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      rawBody?: Buffer;
    }
  }
}

export function signAccessToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn']
  });
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization Bearer token');
    }

    const token = header.slice('Bearer '.length).trim();
    const decoded = jwt.verify(token, env.jwtSecret) as { userId: string; email: string };
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new UnauthorizedError('Authenticated user account not found');
    }

    const requestedOrgId = req.headers['x-organization-id'];
    const targetOrgId =
      typeof requestedOrgId === 'string' && mongoose.isValidObjectId(requestedOrgId)
        ? requestedOrgId
        : user.defaultOrganizationId?.toString();

    if (!targetOrgId) {
      throw new ForbiddenError('No active organization associated with user');
    }

    const membership = await Membership.findOne({
      organizationId: targetOrgId,
      userId: user._id,
      status: 'active'
    });

    if (!membership) {
      throw new ForbiddenError('User does not belong to the requested organization');
    }

    const orgExists = await Organization.exists({ _id: targetOrgId });
    if (!orgExists) {
      throw new ForbiddenError('Active organization no longer exists');
    }

    req.auth = {
      userId: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      organizationId: targetOrgId,
      role: membership.role
    };

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired authentication token'));
      return;
    }
    next(err);
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    if (!allowedRoles.includes(req.auth.role)) {
      next(new ForbiddenError(`Action requires one of roles: ${allowedRoles.join(', ')}`));
      return;
    }
    next();
  };
}

export async function recordAuditLog(params: {
  organizationId: string;
  actorUserId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await AuditLog.create(params);
  } catch {
    // Audit write failure should not crash request flow, but could be monitored
  }
}
