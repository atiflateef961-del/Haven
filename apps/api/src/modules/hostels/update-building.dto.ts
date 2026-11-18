import { z } from 'zod';

export const updateBuildingSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
}).strict().refine((value) => value.name !== undefined, {
  message: 'A building name must be provided',
});

export type UpdateBuildingDto = z.infer<typeof updateBuildingSchema>;

export const buildingIdSchema = z.string().uuid();
