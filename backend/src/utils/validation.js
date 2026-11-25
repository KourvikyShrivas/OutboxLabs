const { z } = require('zod');

const MAX_PAST_MS = 60 * 1000; // tolerate small client clock skew
const MAX_FUTURE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

const scheduleEmailSchema = z.object({
  to: z.string({ required_error: 'to is required' }).trim().email('to must be a valid email address').max(254),
  subject: z.string({ required_error: 'subject is required' }).trim().min(1, 'subject cannot be empty').max(200),
  body: z.string({ required_error: 'body is required' }).trim().min(1, 'body cannot be empty').max(10000),
  scheduledAt: z
    .string({ required_error: 'scheduledAt is required' })
    .datetime({
      offset: true,
      message: 'scheduledAt must be an ISO 8601 date with timezone, e.g. 2026-11-25T18:30:00Z or 2026-11-25T18:30:00+05:30',
    })
    .refine((v) => new Date(v).getTime() >= Date.now() - MAX_PAST_MS, { message: 'scheduledAt cannot be in the past' })
    .refine((v) => new Date(v).getTime() <= Date.now() + MAX_FUTURE_MS, { message: 'scheduledAt cannot be more than 1 year ahead' }),
  // Optional per-email overrides of the .env defaults
  attempts: z.number().int().min(1).max(10).optional(),
  backoffDelayMs: z.number().int().min(100).max(3600000).optional(),
});

module.exports = { scheduleEmailSchema };
