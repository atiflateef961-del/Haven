import { z } from 'zod';

export const attendanceSchema = z.object({
  attendanceDate: z.iso.date(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  note: z.string().trim().max(500).nullable().optional(),
}).strict();

export type AttendanceDto = z.infer<typeof attendanceSchema>;
