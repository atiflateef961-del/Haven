import { z } from 'zod';

export const guardianIdSchema = z.uuid();

export const createGuardianSchema = z.object({
  name: z.string().trim().min(1).max(160),
  relationship: z.string().trim().min(1).max(60).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().min(1).max(32),
}).strict();

export type CreateGuardianDto = z.infer<typeof createGuardianSchema>;

export const updateGuardianSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  relationship: z.string().trim().min(1).max(60).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().min(1).max(32).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type UpdateGuardianDto = z.infer<typeof updateGuardianSchema>;
