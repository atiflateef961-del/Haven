import { z } from 'zod';

export const createMaintenanceSchema = z.object({
  hostelId: z.uuid(), complaintId: z.uuid().nullable().optional(), assigneeId: z.uuid().nullable().optional(),
  title: z.string().trim().min(1).max(180), description: z.string().trim().min(1).max(2000),
}).strict();

export const updateMaintenanceSchema = z.object({
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  assigneeId: z.uuid().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one change is required');

export type CreateMaintenanceDto = z.infer<typeof createMaintenanceSchema>;
export type UpdateMaintenanceDto = z.infer<typeof updateMaintenanceSchema>;
