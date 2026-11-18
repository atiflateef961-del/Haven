import { z } from 'zod';

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320),
    password: z.string().min(8).max(1024),
    confirmPassword: z.string().min(8).max(1024),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type RegisterDto = z.infer<typeof registerSchema>;
