import { z } from 'zod';

export const passwordResetSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    newPassword: z.string().min(15).max(1024),
  })
  .strict();

export type PasswordResetDto = z.infer<typeof passwordResetSchema>;

export const passwordResetRequestSchema = z.object({ email: z.string().email().max(320) }).strict();
export type PasswordResetRequestDto = z.infer<typeof passwordResetRequestSchema>;
