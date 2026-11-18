import { z } from 'zod';

export const createBedSchema = z.object({
  label: z.string().trim().min(1).max(40),
}).strict();

export type CreateBedDto = z.infer<typeof createBedSchema>;
