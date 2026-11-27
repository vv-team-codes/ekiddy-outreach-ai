import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  WORK_EMAIL_ONLY_MESSAGE,
  forgotPasswordSchema,
  isWorkEmail,
  loginSchema,
  registerSchema,
  resetPasswordSchema
} from '@ekiddy/shared';
import { authenticate, recordAuditLog, signAccessToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  CreditTransaction,
  Membership,
  Organization,
  Project,
  SendingAccount,
  Subscription,
  User,
  type IUser
} from '../models/index.js';
import { verifyFirebaseIdToken } from '../services/firebase.service.js';
import { generateRandomToken, hashToken } from '../utils/crypto.js';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors.js';

export const authRouter = Router();

/**
 * Auth abuse controls. The general /api limiter allows 300 req/min; auth
 * routes are deliberately stricter. express-rate-limit keys by IP (the app
 * sets `trust proxy` to 1, so the real client IP is used behind Caddy).
 */
function authRateLimit(max: number) {
  return rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false
  });
}

const firebaseExchangeSchema = z.object({
  idToken: z.string().min(10).max(8192),
  fullName: z.string().trim().min(2).max(100).optional(),
  organizationName: z.string().trim().min(2).max(100).optional(),
  websiteUrl: z.string().trim().url().optional().or(z.literal(''))
});

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'workspace'
  );
}

function shapeUser(user: IUser) {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    emailVerified: user.emailVerified,
    jobTitle: user.jobTitle,
    timezone: user.timezone,
    defaultOrganizationId: user.defaultOrganizationId?.toString(),
    preferences: user.preferences
  };
}

async function loadMemberships(user: IUser) {
  const memberships = await Membership.find({ userId: user._id, status: 'active' }).populate(
    'organizationId'
  );
  const activeMembership =
    memberships.find(
      (m) => m.organizationId?._id?.toString() === user.defaultOrganizationId?.toString()
    ) || memberships[0];
  return {
    organization: activeMembership?.organizationId || null,
    organizations: memberships.map((m) => ({
      organization: m.organizationId,
      role: m.role
    }))
  };
}

/**
 * The single workspace-provisioning path, shared by /register and the
 * Firebase exchange: User + Organization (slug, 500 credits) + owner
 * Membership + Project + Subscription + sandbox SendingAccount + audit log.
 * A user must never end up without an organization.
 */
async function provisionWorkspaceForUser(params: {
  user: IUser;
  fullName: string;
  organizationName?: string;
  websiteUrl?: string;
}) {
  const { user, fullName, organizationName, websiteUrl } = params;
  const orgTitle = organizationName || `${fullName.split(' ')[0]}'s Workspace`;
  const uniqueSuffix = uuidv4().slice(0, 6);
  const slug = `${slugify(orgTitle)}-${uniqueSuffix}`;

  const org = await Organization.create({
    name: orgTitle,
    slug,
    website: websiteUrl || undefined,
    creditBalance: 500,
    plan: 'free',
    bookingSlug: slug,
    onboarding: {
      currentStep: 1,
      completed: false,
      websiteUrl: websiteUrl || undefined
    }
  });

  user.defaultOrganizationId = org._id;
  await user.save();

  await Membership.create({
    organizationId: org._id,
    userId: user._id,
    role: 'owner',
    status: 'active'
  });

  const project = await Project.create({
    organizationId: org._id,
    name: 'Primary Outbound Project',
    websiteUrl: websiteUrl || undefined,
    createdBy: user._id
  });

  org.onboarding.projectId = project._id;
  await org.save();

  await CreditTransaction.create({
    organizationId: org._id,
    userId: user._id,
    type: 'grant',
    operation: 'welcome_credits',
    amount: 500,
    balanceAfter: 500,
    idempotencyKey: `welcome:${org._id.toString()}`,
    description: 'Welcome credit grant for new ekiddy Outreach AI workspace'
  });

  await Subscription.create({
    organizationId: org._id,
    planId: 'free',
    status: 'active',
    billingProvider: 'test'
  });

  await SendingAccount.create({
    organizationId: org._id,
    email: `sandbox-${uniqueSuffix}@sandbox.ekiddy.local`,
    fromName: fullName,
    domain: 'sandbox.ekiddy.local',
    provider: 'sandbox',
    dailyLimit: 50,
    verified: true,
    status: 'active',
    dnsStatus: {
      spfValid: true,
      dkimConfigured: true,
      dmarcValid: true,
      checkedAt: new Date(),
      guidance: ['Built-in Sandbox Outbox active for safe test campaigns. Add an SMTP or Resend domain for live sending.']
    }
  });

  return { organization: org, project };
}

authRouter.post(
  '/register',
  authRateLimit(10),
  validateBody(registerSchema),
  async (req, res, next) => {
    try {
      const { fullName, email, password, organizationName, websiteUrl } = req.body;
      if (!isWorkEmail(email)) {
        throw new BadRequestError(WORK_EMAIL_ONLY_MESSAGE);
      }
      const existing = await User.findOne({ email });
      if (existing) {
        throw new ConflictError('An account with this email already exists');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      // Stored hashed only; the raw token is never returned in any response.
      const verifyRawToken = generateRandomToken(24);

      const user = await User.create({
        fullName,
        email,
        passwordHash,
        emailVerified: false,
        emailVerificationTokenHash: hashToken(verifyRawToken)
      });

      const { organization: org } = await provisionWorkspaceForUser({
        user,
        fullName,
        organizationName,
        websiteUrl
      });

      await recordAuditLog({
        organizationId: org._id.toString(),
        actorUserId: user._id.toString(),
        action: 'user.registered',
        resourceType: 'User',
        resourceId: user._id.toString(),
        ipAddress: req.ip
      });

      const token = signAccessToken({ userId: user._id.toString(), email: user.email });

      res.status(201).json({
        success: true,
        data: {
          token,
          user: shapeUser(user),
          organization: org,
          organizations: [{ organization: org, role: 'owner' }]
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post('/login', authRateLimit(10), validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!isWorkEmail(email)) {
      throw new BadRequestError(WORK_EMAIL_ONLY_MESSAGE);
    }
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedError('Invalid email or password');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const { organization, organizations } = await loadMemberships(user);
    const token = signAccessToken({ userId: user._id.toString(), email: user.email });

    res.json({
      success: true,
      data: {
        token,
        user: shapeUser(user),
        organization,
        organizations
      }
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  res.json({ success: true, data: { loggedOut: true } });
});

authRouter.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth!.userId);
    if (!user) throw new NotFoundError('User not found');

    const memberships = await Membership.find({ userId: user._id, status: 'active' }).populate('organizationId');
    const activeOrg = await Organization.findById(req.auth!.organizationId);

    res.json({
      success: true,
      data: {
        user: shapeUser(user),
        role: req.auth!.role,
        organization: activeOrg,
        organizations: memberships.map((m) => ({
          organization: m.organizationId,
          role: m.role
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '');
    if (!token) throw new BadRequestError('Verification token is required');
    const user = await User.findOne({ emailVerificationTokenHash: hashToken(token) });
    if (!user) throw new BadRequestError('Invalid or expired verification token');
    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    await user.save();
    res.json({ success: true, data: { verified: true } });
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  '/forgot-password',
  authRateLimit(5),
  validateBody(forgotPasswordSchema),
  async (req, res, next) => {
    try {
      const user = await User.findOne({ email: req.body.email });
      if (user) {
        const rawToken = generateRandomToken(24);
        user.passwordResetTokenHash = hashToken(rawToken);
        user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();
        // The raw reset token is never returned in any response; it is only
        // delivered through the out-of-band reset email flow.
      }
      res.json({
        success: true,
        data: {
          message: 'If an account matches that email, password reset instructions have been prepared.'
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post('/reset-password', validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    const user = await User.findOne({
      passwordResetTokenHash: hashToken(req.body.token),
      passwordResetExpiresAt: { $gt: new Date() }
    });
    if (!user) throw new BadRequestError('Invalid or expired password reset token');
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    res.json({ success: true, data: { reset: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * Firebase exchange: swaps a verified Firebase ID token for the backend JWT.
 * Verification is done server-side with firebase-admin (signature, audience,
 * issuer, expiry, revocation) — never via the tokeninfo endpoint.
 * - Email/password accounts must have a verified email first; Google
 *   accounts arrive verified, so they are not held to that check.
 * - Only work emails are accepted (shared isWorkEmail rule).
 * - Lookup is by firebaseUid first, then lowercased email. An email match
 *   with a different firebaseUid is rejected, never silently merged.
 * - New users get the same workspace provisioning as /register, and legacy
 *   org-less users are provisioned on sign-in, so nobody stays org-less.
 * Returns the same shaped payload as /login.
 */
authRouter.post(
  '/firebase',
  authRateLimit(10),
  validateBody(firebaseExchangeSchema),
  async (req, res, next) => {
    try {
      const { idToken, fullName, organizationName, websiteUrl } = req.body;
      const verified = await verifyFirebaseIdToken(idToken);
      const email = (verified.email || '').trim().toLowerCase();
      if (!email) {
        throw new UnauthorizedError('Firebase token has no email address');
      }
      if (!isWorkEmail(email)) {
        throw new BadRequestError(WORK_EMAIL_ONLY_MESSAGE);
      }
      if (!verified.emailVerified && verified.signInProvider !== 'google.com') {
        throw new UnauthorizedError('Please verify your email address before signing in.');
      }

      let user = await User.findOne({ firebaseUid: verified.uid });
      if (!user) {
        user = await User.findOne({ email });
        if (user) {
          if (user.firebaseUid && user.firebaseUid !== verified.uid) {
            throw new ConflictError('This email is already linked to a different sign-in account');
          }
          user.firebaseUid = verified.uid;
          user.emailVerified = true;
          await user.save();
        }
      }
      if (!user) {
        user = await User.create({
          email,
          fullName: fullName || verified.name || email.split('@')[0],
          firebaseUid: verified.uid,
          emailVerified: true
        });
      }

      const memberships = await loadMemberships(user);
      let organization = memberships.organization;
      let organizations = memberships.organizations;
      if (organizations.length === 0) {
        const provisioned = await provisionWorkspaceForUser({
          user,
          fullName: user.fullName,
          organizationName,
          websiteUrl
        });
        organization = provisioned.organization;
        organizations = [{ organization: provisioned.organization, role: 'owner' }];
      }

      user.lastLoginAt = new Date();
      await user.save();

      await recordAuditLog({
        organizationId: (organization as { _id: { toString(): string } })._id.toString(),
        actorUserId: user._id.toString(),
        action: 'user.firebase_signed_in',
        resourceType: 'User',
        resourceId: user._id.toString(),
        ipAddress: req.ip
      });

      const token = signAccessToken({ userId: user._id.toString(), email: user.email });
      res.json({
        success: true,
        data: {
          token,
          user: shapeUser(user),
          organization,
          organizations
        }
      });
    } catch (err) {
      next(err);
    }
  }
);
