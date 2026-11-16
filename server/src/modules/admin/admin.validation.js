import { z } from 'zod';

export const issueListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'MERGED']).optional()
}).strict();

export const issueIdSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
export const assignOfficerSchema = z.object({ officerId: z.coerce.number().int().positive() }).strict();
export const duplicateListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
  status: z.enum(['PENDING','APPROVED','REJECTED','STALE']).default('PENDING')
}).strict();
export const duplicateIdSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
export const approveDuplicateSchema = z.object({ canonicalIssueId: z.number().int().positive() }).strict();
export const rejectDuplicateSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
