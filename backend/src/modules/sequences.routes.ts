import { Router } from 'express';
import { sequenceStepSchema } from '@ekiddy/shared';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { Campaign, EmailSequence } from '../models/index.js';
import { NotFoundError, ok } from '../utils/errors.js';

export const sequencesRouter = Router();
sequencesRouter.use(authenticate);

sequencesRouter.get('/:campaignId', async (req, res, next) => {
  try {
    const sequence = await EmailSequence.findOne({
      campaignId: req.params.campaignId,
      organizationId: req.auth!.organizationId
    });
    if (!sequence) throw new NotFoundError('Sequence not found');
    ok(res, sequence);
  } catch (err) {
    next(err);
  }
});

const updateSequenceSchema = z.object({
  steps: z.array(sequenceStepSchema).min(1).max(10)
});

sequencesRouter.put('/:campaignId', validateBody(updateSequenceSchema), async (req, res, next) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.campaignId,
      organizationId: req.auth!.organizationId
    });
    if (!campaign) throw new NotFoundError('Campaign not found');

    const sequence = await EmailSequence.findOneAndUpdate(
      { campaignId: campaign._id, organizationId: req.auth!.organizationId },
      { organizationId: req.auth!.organizationId, campaignId: campaign._id, steps: req.body.steps },
      { upsert: true, new: true }
    );
    campaign.sequenceId = sequence._id;
    await campaign.save();

    ok(res, sequence);
  } catch (err) {
    next(err);
  }
});
