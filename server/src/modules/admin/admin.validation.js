import { z } from 'zod';
import { departments } from '../intelligence/intelligence.taxonomy.js';

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

const activeQuery = z.enum(['true', 'false']).optional().transform(value => value === 'true');
export const wardIdSchema = z.object({ id: z.coerce.number().int().positive() }).strict();
export const memberParamsSchema = z.object({ id: z.coerce.number().int().positive(), userId: z.coerce.number().int().positive() }).strict();
export const wardListQuerySchema = z.object({ includeInactive: activeQuery }).strict();
export const teamListQuerySchema = z.object({
  wardId: z.coerce.number().int().positive().optional(),
  includeInactive: activeQuery
}).strict();
export const membershipListQuerySchema = z.object({ includeHistory: activeQuery }).strict();
export const createWardSchema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/).transform(value => value.toUpperCase()),
  name: z.string().trim().min(1).max(100)
}).strict();
export const updateWardSchema = z.object({
  code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/).transform(value => value.toUpperCase()).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  active: z.boolean().optional()
}).strict().refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });
export const createTeamSchema = z.object({
  wardId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  department: z.enum(departments)
}).strict();
export const updateTeamSchema = z.object({
  wardId: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  department: z.enum(departments).optional(),
  active: z.boolean().optional()
}).strict().refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });
export const addTeamMemberSchema = z.object({ officerId: z.number().int().positive() }).strict();
export const teamRoutingSchema = z.object({
  teamId: z.number().int().positive(),
  routingDepartment: z.enum(departments)
}).strict();
