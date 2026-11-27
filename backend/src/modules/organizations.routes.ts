import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createOrganizationSchema, inviteMemberSchema } from '@ekiddy/shared';
import { authenticate, recordAuditLog, requireRole } from '../middleware/auth.middleware.js';
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
import { BadRequestError, ForbiddenError, NotFoundError, ok } from '../utils/errors.js';

export const organizationsRouter = Router();
organizationsRouter.use(authenticate);

organizationsRouter.get('/', async (req, res, next) => {
  try {
    const memberships = await Membership.find({ userId: req.auth!.userId, status: 'active' }).populate('organizationId');
    ok(
      res,
      memberships.map((m) => ({
        organization: m.organizationId,
        role: m.role
      }))
    );
  } catch (err) {
    next(err);
  }
});

organizationsRouter.post('/', validateBody(createOrganizationSchema), async (req, res, next) => {
  try {
    const { name, website, industry } = req.body;
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';
    const unique = uuidv4().slice(0, 6);
    const slug = `${baseSlug}-${unique}`;

    const org = await Organization.create({
      name,
      slug,
      website: website || undefined,
      industry: industry || undefined,
      creditBalance: 500,
      plan: 'free',
      bookingSlug: slug
    });

    await Membership.create({
      organizationId: org._id,
      userId: req.auth!.userId,
      role: 'owner',
      status: 'active'
    });

    await Project.create({
      organizationId: org._id,
      name: 'Default Project',
      websiteUrl: website || undefined,
      createdBy: req.auth!.userId
    });

    await CreditTransaction.create({
      organizationId: org._id,
      userId: req.auth!.userId,
      type: 'grant',
      operation: 'welcome_credits',
      amount: 500,
      balanceAfter: 500,
      idempotencyKey: `welcome:${org._id.toString()}`,
      description: 'Welcome credit grant for new organization'
    });

    await Subscription.create({ organizationId: org._id, planId: 'free', status: 'active' });
    await SendingAccount.create({
      organizationId: org._id,
      email: `sandbox-${unique}@sandbox.ekiddy.local`,
      fromName: req.auth!.fullName,
      domain: 'sandbox.ekiddy.local',
      provider: 'sandbox',
      verified: true,
      status: 'active'
    });

    ok(res, org, undefined, 201);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.patch('/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    if (req.params.id !== req.auth!.organizationId) {
      throw new ForbiddenError('Cannot modify another organization');
    }
    const { name, website, industry, bookingSlug } = req.body as Record<string, string | undefined>;
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      {
        ...(name ? { name: name.trim() } : {}),
        ...(website !== undefined ? { website } : {}),
        ...(industry !== undefined ? { industry } : {}),
        ...(bookingSlug ? { bookingSlug: bookingSlug.toLowerCase().trim() } : {})
      },
      { new: true }
    );
    if (!org) throw new NotFoundError('Organization not found');
    ok(res, org);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.get('/:id/members', async (req, res, next) => {
  try {
    if (req.params.id !== req.auth!.organizationId) {
      throw new ForbiddenError('Cannot inspect members of another organization');
    }
    const members = await Membership.find({ organizationId: req.params.id }).populate('userId', 'fullName email avatarUrl');
    ok(res, members);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.post('/:id/invitations', requireRole('owner', 'admin'), validateBody(inviteMemberSchema), async (req, res, next) => {
  try {
    if (req.params.id !== req.auth!.organizationId) {
      throw new ForbiddenError('Cannot invite to another organization');
    }
    const rawToken = generateRandomToken(20);
    const membership = await Membership.create({
      organizationId: req.params.id,
      role: req.body.role,
      status: 'invited',
      inviteEmail: req.body.email,
      inviteTokenHash: hashToken(rawToken),
      invitedBy: req.auth!.userId
    });

    await recordAuditLog({
      organizationId: req.auth!.organizationId,
      actorUserId: req.auth!.userId,
      action: 'organization.member_invited',
      resourceType: 'Membership',
      resourceId: membership._id.toString(),
      metadata: { email: req.body.email, role: req.body.role }
    });

    // The raw invite token is never returned in any response; it is only
    // delivered through the out-of-band invite email flow.
    ok(res, { membership }, undefined, 201);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.post('/invitations/accept', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '');
    if (!token) throw new BadRequestError('Invitation token is required');

    const invite = await Membership.findOne({
      inviteTokenHash: hashToken(token),
      status: 'invited'
    });
    if (!invite) throw new NotFoundError('Invalid or already accepted invitation');

    invite.userId = (await User.findById(req.auth!.userId))!._id;
    invite.status = 'active';
    invite.inviteTokenHash = undefined;
    await invite.save();

    ok(res, invite);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.patch('/:id/members/:memberId', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    if (req.params.id !== req.auth!.organizationId) {
      throw new ForbiddenError('Cannot modify another organization');
    }
    const { role, status } = req.body as { role?: string; status?: string };
    const member = await Membership.findOne({ _id: req.params.memberId, organizationId: req.params.id });
    if (!member) throw new NotFoundError('Membership not found');
    if (member.role === 'owner' && role && role !== 'owner') {
      throw new BadRequestError('Cannot downgrade organization owner directly');
    }
    if (role && ['admin', 'member', 'viewer'].includes(role)) {
      member.role = role as typeof member.role;
    }
    if (status && ['active', 'suspended'].includes(status)) {
      member.status = status as typeof member.status;
    }
    await member.save();
    ok(res, member);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.get('/:id/onboarding', async (req, res, next) => {
  try {
    if (req.params.id !== req.auth!.organizationId) {
      throw new ForbiddenError('Cannot access another organization');
    }
    const org = await Organization.findById(req.params.id);
    if (!org) throw new NotFoundError('Organization not found');
    ok(res, org.onboarding);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.patch('/:id/onboarding', async (req, res, next) => {
  try {
    if (req.params.id !== req.auth!.organizationId) {
      throw new ForbiddenError('Cannot update another organization');
    }
    const org = await Organization.findById(req.params.id);
    if (!org) throw new NotFoundError('Organization not found');

    const { currentStep, completed, websiteUrl, projectId, researchId, approved } = req.body as {
      currentStep?: number;
      completed?: boolean;
      websiteUrl?: string;
      projectId?: string;
      researchId?: string;
      approved?: boolean;
    };

    if (typeof currentStep === 'number') org.onboarding.currentStep = Math.max(1, Math.min(8, currentStep));
    if (typeof completed === 'boolean') org.onboarding.completed = completed;
    if (websiteUrl !== undefined) {
      org.onboarding.websiteUrl = websiteUrl;
      org.website = websiteUrl;
    }
    if (projectId) org.onboarding.projectId = projectId as unknown as typeof org.onboarding.projectId;
    if (researchId) org.onboarding.researchId = researchId as unknown as typeof org.onboarding.researchId;
    if (approved) {
      org.onboarding.approvedAt = new Date();
      org.onboarding.completed = true;
      org.onboarding.currentStep = 8;
    }

    await org.save();
    ok(res, org.onboarding);
  } catch (err) {
    next(err);
  }
});
