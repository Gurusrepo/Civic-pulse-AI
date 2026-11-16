import { z } from 'zod';

export const issueIdSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
export const issueListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional()
}).strict();
export const repairEvidenceSchema = z.object({ stage: z.enum(['BEFORE', 'AFTER']) }).strict();
