import { z } from 'zod';

export const createHostelSchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  address: z.string().trim().min(1).max(500).optional(),
}).strict();

export type CreateHostelDto = z.infer<typeof createHostelSchema>;
