import { z } from 'zod';

export const updateBedSchema = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => value.label !== undefined || value.isActive !== undefined, {
  message: 'At least one bed field must be provided',
});

export type UpdateBedDto = z.infer<typeof updateBedSchema>;
export const bedIdSchema = z.string().uuid();
