import { z } from 'zod';

export const createComplaintSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(4000),
}).strict();

export const updateComplaintSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assignedStaffId: z.uuid().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one change is required');

export type CreateComplaintDto = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintDto = z.infer<typeof updateComplaintSchema>;
