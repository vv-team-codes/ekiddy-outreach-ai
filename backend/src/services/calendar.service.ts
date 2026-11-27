import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { Integration, Meeting } from '../models/index.js';
import { decryptObject, encryptObject } from '../utils/crypto.js';
import { BadRequestError } from '../utils/errors.js';

export function buildGoogleCalendarAuthUrl(state: string): {
  configured: boolean;
  authUrl: string | null;
} {
  if (!env.googleClientId || !env.googleClientSecret) {
    return { configured: false, authUrl: null };
  }
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleRedirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
    state
  });
  return {
    configured: true,
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  };
}

export async function exchangeGoogleAuthCode(organizationId: string, code: string) {
  if (!env.googleClientId || !env.googleClientSecret) {
    throw new BadRequestError('Google Calendar OAuth credentials are not configured on this server');
  }
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleRedirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!tokenRes.ok) {
    throw new BadRequestError('Failed to exchange Google OAuth authorization code');
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  await Integration.findOneAndUpdate(
    { organizationId, provider: 'google_calendar' },
    {
      organizationId,
      provider: 'google_calendar',
      status: 'connected',
      encryptedCredentials: encryptObject({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || ''
      }),
      maskedPreview: 'Google Calendar OAuth Connected',
      publicConfig: { calendarId: 'primary' },
      lastCheckedAt: new Date()
    },
    { upsert: true, new: true }
  );
}

async function getGoogleAccessToken(organizationId: string): Promise<string | null> {
  const integration = await Integration.findOne({
    organizationId,
    provider: 'google_calendar',
    status: 'connected'
  }).select('+encryptedCredentials');

  if (!integration?.encryptedCredentials) return null;

  try {
    const creds = decryptObject<{ accessToken?: string; refreshToken?: string }>(
      integration.encryptedCredentials
    );
    if (creds.refreshToken && env.googleClientId && env.googleClientSecret) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.googleClientId,
          client_secret: env.googleClientSecret,
          refresh_token: creds.refreshToken,
          grant_type: 'refresh_token'
        })
      });
      if (refreshRes.ok) {
        const refreshed = (await refreshRes.json()) as { access_token: string };
        return refreshed.access_token;
      }
    }
    return creds.accessToken || null;
  } catch {
    return null;
  }
}

export async function getAvailabilitySlots(params: {
  organizationId: string;
  dateStr: string;
  timezone: string;
}) {
  const baseDate = new Date(`${params.dateStr}T00:00:00.000Z`);
  if (Number.isNaN(baseDate.getTime())) {
    throw new BadRequestError('Invalid date format; expected YYYY-MM-DD');
  }

  const dayStart = new Date(baseDate);
  const dayEnd = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);

  const existingMeetings = await Meeting.find({
    organizationId: params.organizationId,
    status: { $in: ['scheduled', 'rescheduled'] },
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart }
  });

  const slots: Array<{ startTime: string; endTime: string; available: boolean }> = [];
  for (let hour = 9; hour < 17; hour++) {
    const slotStart = new Date(baseDate.getTime() + hour * 60 * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
    const conflict = existingMeetings.some(
      (m) => m.startTime < slotEnd && m.endTime > slotStart
    );
    slots.push({
      startTime: slotStart.toISOString(),
      endTime: slotEnd.toISOString(),
      available: !conflict
    });
  }

  const googleToken = await getGoogleAccessToken(params.organizationId);
  return {
    date: params.dateStr,
    timezone: params.timezone,
    calendarProvider: googleToken ? 'google' : 'local',
    slots
  };
}

export async function scheduleCalendarMeeting(params: {
  organizationId: string;
  hostUserId?: string;
  contactId?: string;
  campaignId?: string;
  conversationId?: string;
  title: string;
  description?: string;
  attendeeName: string;
  attendeeEmail: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
}) {
  if (params.endTime <= params.startTime) {
    throw new BadRequestError('Meeting endTime must be after startTime');
  }

  const conflict = await Meeting.findOne({
    organizationId: params.organizationId,
    status: { $in: ['scheduled', 'rescheduled'] },
    startTime: { $lt: params.endTime },
    endTime: { $gt: params.startTime }
  });
  if (conflict) {
    throw new BadRequestError('Selected time slot overlaps an existing scheduled meeting');
  }

  let calendarProvider: 'google' | 'local' = 'local';
  let externalEventId = `local_${uuidv4()}`;
  let meetingLink = `${env.appUrl}/meetings/room/${externalEventId}`;

  const googleToken = await getGoogleAccessToken(params.organizationId);
  if (googleToken) {
    try {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${googleToken}`
          },
          body: JSON.stringify({
            summary: params.title,
            description: params.description,
            start: { dateTime: params.startTime.toISOString(), timeZone: params.timezone },
            end: { dateTime: params.endTime.toISOString(), timeZone: params.timezone },
            attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }]
          })
        }
      );
      if (res.ok) {
        const event = (await res.json()) as { id: string; hangoutLink?: string; htmlLink?: string };
        calendarProvider = 'google';
        externalEventId = event.id;
        meetingLink = event.hangoutLink || event.htmlLink || meetingLink;
      }
    } catch {
      // Fallback to local persisted meeting if Google API call fails transiently
    }
  }

  return Meeting.create({
    organizationId: params.organizationId,
    hostUserId: params.hostUserId,
    contactId: params.contactId,
    campaignId: params.campaignId,
    conversationId: params.conversationId,
    title: params.title,
    description: params.description,
    attendeeName: params.attendeeName,
    attendeeEmail: params.attendeeEmail,
    startTime: params.startTime,
    endTime: params.endTime,
    timezone: params.timezone,
    status: 'scheduled',
    calendarProvider,
    externalEventId,
    meetingLink
  });
}
