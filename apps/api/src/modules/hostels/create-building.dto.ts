import { z } from 'zod';

export const createBuildingSchema = z.object({
  name: z.string().trim().min(1).max(120),
}).strict();

export type CreateBuildingDto = z.infer<typeof createBuildingSchema>;
