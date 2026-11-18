import { z } from 'zod';

export const createStudentBookingSchema = z.object({
  requestedFrom: z.iso.date(),
  requestedUntil: z.iso.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
}).strict().refine(
  (value) => value.requestedUntil == null || value.requestedUntil > value.requestedFrom,
  { path: ['requestedUntil'], message: 'The end date must be after the start date' },
);

export type CreateStudentBookingDto = z.infer<typeof createStudentBookingSchema>;
