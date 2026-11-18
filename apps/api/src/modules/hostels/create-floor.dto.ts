import { z } from 'zod';

export const createFloorSchema = z.object({
  number: z.number().int().min(-2_147_483_648).max(2_147_483_647),
}).strict();

export type CreateFloorDto = z.infer<typeof createFloorSchema>;
