import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  unreadOnly: z.enum(['true', 'false']).optional().transform((value) => value === 'true')
}).strict();

export const notificationIdSchema = z.object({
  id: z.coerce.number().int().positive()
}).strict();
