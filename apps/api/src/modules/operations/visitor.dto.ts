import { z } from 'zod';

export const createVisitorSchema = z.object({
  studentId: z.uuid(),
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(32).nullable().optional(),
  purpose: z.string().trim().min(1).max(500),
  visitAt: z.iso.datetime({ offset: true }),
}).strict();

export type CreateVisitorDto = z.infer<typeof createVisitorSchema>;
