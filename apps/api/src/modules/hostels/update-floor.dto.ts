import { z } from 'zod';

export const updateFloorSchema = z.object({
  number: z.number().int().min(-2_147_483_648).max(2_147_483_647),
}).strict();

export type UpdateFloorDto = z.infer<typeof updateFloorSchema>;

export const floorIdSchema = z.string().uuid();
