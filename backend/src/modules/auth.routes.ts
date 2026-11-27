import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema
} from '@ekiddy/shared';
import { env } from '../config/env.js';
import { authenticate, recordAuditLog, signAccessToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  CreditTransaction,
  Membership,
  Organization,
  Project,
  SendingAccount,
  Subscription,
  User
} from '../models/index.js';
import { generateRandomToken, hashToken } from '../utils/crypto.js';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors.js';

export const authRouter = Router();

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'workspace'
  );
}

authRouter.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { fullName, email, password, organizationName, websiteUrl } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verifyRawToken = generateRandomToken(24);
    const orgTitle = organizationName || `${fullName.split(' ')[0]}'s Workspace`;
    const uniqueSuffix = uuidv4().slice(0, 6);
    const slug = `${slugify(orgTitle)}-${uniqueSuffix}`;

    const user = await User.create({
      fullName,
      email,
      passwordHash,
      emailVerified: false,
      emailVerificationTokenHash: hashToken(verifyRawToken)
    });

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
        user: {
          id: user._id.toString(),
          fullName: user.fullName,
          email: user.email,
          emailVerified: user.emailVerified,
          defaultOrganizationId: org._id.toString(),
          preferences: user.preferences
        },
        organization: org,
        organizations: [{ organization: org, role: 'owner' }],
        ...(env.nodeEnv !== 'production' ? { devVerificationToken: verifyRawToken } : {})
      }
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
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

    const memberships = await Membership.find({ userId: user._id, status: 'active' }).populate('organizationId');
    const activeMembership =
      memberships.find((m) => m.organizationId?._id?.toString() === user.defaultOrganizationId?.toString()) ||
      memberships[0];

    const token = signAccessToken({ userId: user._id.toString(), email: user.email });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id.toString(),
          fullName: user.fullName,
          email: user.email,
          emailVerified: user.emailVerified,
          jobTitle: user.jobTitle,
          timezone: user.timezone,
          defaultOrganizationId: user.defaultOrganizationId?.toString(),
          preferences: user.preferences
        },
        organization: activeMembership?.organizationId || null,
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
        user: {
          id: user._id.toString(),
          fullName: user.fullName,
          email: user.email,
          emailVerified: user.emailVerified,
          jobTitle: user.jobTitle,
          timezone: user.timezone,
          defaultOrganizationId: user.defaultOrganizationId?.toString(),
          preferences: user.preferences
        },
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

authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    let devResetToken: string | undefined;
    if (user) {
      const rawToken = generateRandomToken(24);
      user.passwordResetTokenHash = hashToken(rawToken);
      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      if (env.nodeEnv !== 'production') {
        devResetToken = rawToken;
      }
    }
    res.json({
      success: true,
      data: {
        message: 'If an account matches that email, password reset instructions have been prepared.',
        ...(devResetToken ? { devResetToken } : {})
      }
    });
  } catch (err) {
    next(err);
  }
});

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

authRouter.post('/firebase', async (req, res, next) => {
  try {
    if (!env.firebaseProjectId) {
      throw new BadRequestError('Firebase authentication is not configured (FIREBASE_PROJECT_ID missing)');
    }
    const idToken = String(req.body?.idToken || '');
    if (!idToken) throw new BadRequestError('Firebase idToken is required');

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!verifyRes.ok) throw new UnauthorizedError('Invalid Firebase ID token');
    const info = (await verifyRes.json()) as { email?: string; sub?: string; name?: string; aud?: string };
    if (!info.email || (info.aud && info.aud !== env.firebaseProjectId)) {
      throw new UnauthorizedError('Firebase token audience mismatch');
    }

    let user = await User.findOne({ email: info.email.toLowerCase() });
    if (!user) {
      user = await User.create({
        email: info.email.toLowerCase(),
        fullName: info.name || info.email.split('@')[0],
        firebaseUid: info.sub,
        emailVerified: true
      });
    }
    const token = signAccessToken({ userId: user._id.toString(), email: user.email });
    res.json({ success: true, data: { token, user } });
  } catch (err) {
    next(err);
  }
});
