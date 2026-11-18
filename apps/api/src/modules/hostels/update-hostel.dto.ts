import { z } from 'zod';

const hostelCodeSchema = z.string().trim().min(1).max(40)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);

export const updateHostelSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  code: hostelCodeSchema.optional(),
  address: z.string().trim().min(1).max(500).nullable().optional(),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: 'At least one hostel field must be provided',
});

export type UpdateHostelDto = z.infer<typeof updateHostelSchema>;

export const hostelIdSchema = z.string().uuid();
