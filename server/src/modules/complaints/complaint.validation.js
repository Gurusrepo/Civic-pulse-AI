import { z } from 'zod';

const formNumber = (schema) => z.string().trim().min(1).refine((value) => Number.isFinite(Number(value)), {
  message: 'Must be a finite number'
}).transform(Number).pipe(schema);

export const createComplaintSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  latitude: formNumber(z.number().min(-90).max(90)),
  longitude: formNumber(z.number().min(-180).max(180)),
  location_accuracy_meters: z.union([
    z.literal(''),
    formNumber(z.number().positive().max(100000))
  ]).optional().transform((value) => value === '' ? undefined : value)
}).strict();

export const listComplaintsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000000).default(0)
}).strict();

export const complaintIdSchema = z.object({
  id: z.coerce.number().int().positive()
}).strict();

export const resolutionVerificationSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('CONFIRM') }).strict(),
  z.object({ decision: z.literal('DISPUTE'), reason: z.string().trim().min(1).max(2000) }).strict()
]);
