import { z } from 'zod';

export const createMessScheduleSchema = z.object({
  hostelId: z.uuid(), mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }),
  menu: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((value) => value.endsAt > value.startsAt, { path: ['endsAt'], message: 'End time must be after start time' });

export const updateMessScheduleSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }).optional(), endsAt: z.iso.datetime({ offset: true }).optional(),
  menu: z.string().trim().max(2000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one change is required');

export const markMealAttendanceSchema = z.object({ studentId: z.uuid() }).strict();
export type CreateMessScheduleDto = z.infer<typeof createMessScheduleSchema>;
export type UpdateMessScheduleDto = z.infer<typeof updateMessScheduleSchema>;
