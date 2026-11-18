import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(1024),
  })
  .strict();

export type LoginDto = z.infer<typeof loginSchema>;
