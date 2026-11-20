import { z } from 'zod';

export const announcementIdSchema = z.object({
  id: z.coerce.number().int().positive()
}).strict();

export const announcementListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).max(1000000).default(0)
}).strict();

const titleSchema = z.string().trim().min(3).max(160);
const descriptionSchema = z.string().trim().min(1).max(3000);
const prioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH']);
const utcDateTimeSchema = z.iso.datetime();

function withValidSchedule(schema) {
  return schema.superRefine(({ startsAt, expiresAt }, context) => {
    if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Expiry must be later than the start time'
      });
    }
  });
}

export const adminAnnouncementListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  priority: prioritySchema.optional(),
  scheduleStatus: z.enum(['UNSCHEDULED', 'SCHEDULED', 'ACTIVE', 'EXPIRED']).optional()
}).strict();

export const createAnnouncementSchema = withValidSchedule(z.object({
  title: titleSchema,
  description: descriptionSchema,
  priority: prioritySchema.default('NORMAL'),
  startsAt: utcDateTimeSchema.nullable().optional(),
  expiresAt: utcDateTimeSchema.nullable().optional()
}).strict());

export const updateAnnouncementSchema = withValidSchedule(z.object({
  title: titleSchema.optional(),
  description: descriptionSchema.optional(),
  priority: prioritySchema.optional(),
  startsAt: utcDateTimeSchema.nullable().optional(),
  expiresAt: utcDateTimeSchema.nullable().optional()
}).strict()).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided'
});

export const announcementPublicationSchema = z.object({
  isPublished: z.boolean()
}).strict();
