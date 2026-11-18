import { z } from 'zod';

export const updateStudentSelfSchema = z.object({
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().min(1).max(32).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type UpdateStudentSelfDto = z.infer<typeof updateStudentSelfSchema>;
