import { z } from 'zod';

export const createStaffSchema = z.object({
  organizationId: z.uuid(), userId: z.uuid(), employeeNumber: z.string().trim().min(1).max(60),
  jobTitle: z.string().trim().min(1).max(120), hostelIds: z.array(z.uuid()).min(1).max(50),
}).strict();

export const updateStaffSchema = z.object({
  employeeNumber: z.string().trim().min(1).max(60).optional(),
  jobTitle: z.string().trim().min(1).max(120).optional(),
  hostelIds: z.array(z.uuid()).max(50).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one change is required');

export type CreateStaffDto = z.infer<typeof createStaffSchema>;
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;
