import { z } from 'zod';

export const announcementIdSchema = z.object({
  id: z.coerce.number().int().positive()
}).strict();

export const announcementListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).max(1000000).default(0)
}).strict();

export const publishAnnouncementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(1).max(3000)
}).strict();
