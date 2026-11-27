import { Router } from 'express';
import { createMeetingSchema } from '@ekiddy/shared';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { Campaign, Contact, Meeting, Organization } from '../models/index.js';
import { getAvailabilitySlots, scheduleCalendarMeeting } from '../services/calendar.service.js';
import { BadRequestError, NotFoundError, ok } from '../utils/errors.js';

export const meetingsRouter = Router();

// Public shareable booking link endpoints
meetingsRouter.get('/public/:slug', async (req, res, next) => {
  try {
    const org = await Organization.findOne({ bookingSlug: req.params.slug.toLowerCase() });
    if (!org) throw new NotFoundError('Booking link not found');

    const dateStr = String(req.query.date || new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    const timezone = String(req.query.timezone || 'UTC');
    const availability = await getAvailabilitySlots({
      organizationId: org._id.toString(),
      dateStr,
      timezone
    });

    ok(res, {
      organizationName: org.name,
      bookingSlug: org.bookingSlug,
      ...availability
    });
  } catch (err) {
    next(err);
  }
});

meetingsRouter.post('/public/:slug/book', async (req, res, next) => {
  try {
    const org = await Organization.findOne({ bookingSlug: req.params.slug.toLowerCase() });
    if (!org) throw new NotFoundError('Booking link not found');

    const { attendeeName, attendeeEmail, startTime, endTime, timezone, title, description } = req.body as Record<
      string,
      string | undefined
    >;
    if (!attendeeName || !attendeeEmail || !startTime || !endTime) {
      throw new BadRequestError('attendeeName, attendeeEmail, startTime, and endTime are required');
    }

    const meeting = await scheduleCalendarMeeting({
      organizationId: org._id.toString(),
      title: title || `Intro Call with ${org.name}`,
      description,
      attendeeName,
      attendeeEmail,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timezone: timezone || 'UTC'
    });

    ok(res, meeting, undefined, 201);
  } catch (err) {
    next(err);
  }
});

// Authenticated organization meeting endpoints
meetingsRouter.use(authenticate);

meetingsRouter.get('/', async (req, res, next) => {
  try {
    const meetings = await Meeting.find({ organizationId: req.auth!.organizationId })
      .sort({ startTime: 1 })
      .populate('contactId', 'fullName email companyName');
    const org = await Organization.findById(req.auth!.organizationId);
    ok(res, {
      bookingSlug: org?.bookingSlug,
      meetings
    });
  } catch (err) {
    next(err);
  }
});

meetingsRouter.get('/availability', async (req, res, next) => {
  try {
    const dateStr = String(req.query.date || new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    const timezone = String(req.query.timezone || 'UTC');
    const availability = await getAvailabilitySlots({
      organizationId: req.auth!.organizationId,
      dateStr,
      timezone
    });
    ok(res, availability);
  } catch (err) {
    next(err);
  }
});

meetingsRouter.post('/', validateBody(createMeetingSchema), async (req, res, next) => {
  try {
    const meeting = await scheduleCalendarMeeting({
      organizationId: req.auth!.organizationId,
      hostUserId: req.auth!.userId,
      contactId: req.body.contactId,
      campaignId: req.body.campaignId,
      conversationId: req.body.conversationId,
      title: req.body.title,
      description: req.body.description,
      attendeeName: req.body.attendeeName,
      attendeeEmail: req.body.attendeeEmail,
      startTime: new Date(req.body.startTime),
      endTime: new Date(req.body.endTime),
      timezone: req.body.timezone
    });

    if (req.body.contactId) {
      await Contact.findOneAndUpdate(
        { _id: req.body.contactId, organizationId: req.auth!.organizationId },
        { stage: 'meeting_booked' }
      );
    }
    if (req.body.campaignId) {
      await Campaign.findOneAndUpdate(
        { _id: req.body.campaignId, organizationId: req.auth!.organizationId },
        { $inc: { 'stats.meetingsBooked': 1 } }
      );
    }

    ok(res, meeting, undefined, 201);
  } catch (err) {
    next(err);
  }
});

meetingsRouter.patch('/:id', async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, organizationId: req.auth!.organizationId });
    if (!meeting) throw new NotFoundError('Meeting not found');

    const { startTime, endTime, title, description, timezone } = req.body as Record<string, string | undefined>;
    if (startTime) meeting.startTime = new Date(startTime);
    if (endTime) meeting.endTime = new Date(endTime);
    if (title) meeting.title = title;
    if (description !== undefined) meeting.description = description;
    if (timezone) meeting.timezone = timezone;
    if (startTime || endTime) meeting.status = 'rescheduled';

    await meeting.save();
    ok(res, meeting);
  } catch (err) {
    next(err);
  }
});

meetingsRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.auth!.organizationId },
      { status: 'cancelled' },
      { new: true }
    );
    if (!meeting) throw new NotFoundError('Meeting not found');
    ok(res, meeting);
  } catch (err) {
    next(err);
  }
});
