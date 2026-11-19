import { z } from 'zod';

export const bugReportSchema = z.object({
  title: z.string().trim().min(3).max(160),
  category: z.enum(['LOGIN_ISSUE', 'PROFILE_ISSUE', 'TECHNICAL_ERROR', 'UI_DESIGN', 'OTHER']),
  description: z.string().trim().min(10).max(5000)
}).strict();

export const suggestionSchema = z.object({
  title: z.string().trim().min(3).max(160),
  category: z.enum(['NEW_FEATURE', 'ACCESSIBILITY', 'USER_EXPERIENCE', 'GOVERNMENT_SERVICES', 'OTHER']),
  description: z.string().trim().min(10).max(5000)
}).strict();
