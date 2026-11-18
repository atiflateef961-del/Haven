import { z } from 'zod';
import { studentStatusSchema } from './student-status.dto.js';

const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable().optional();

export const studentIdSchema = z.uuid();

export const updateStudentSchema = z.object({
  studentNumber: z.string().trim().min(1).max(60).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: optionalText(32),
  dateOfBirth: z.iso.date().nullable().optional(),
  educationInstitution: optionalText(180),
  educationProgram: optionalText(180),
  educationYear: optionalText(40),
  status: studentStatusSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type UpdateStudentDto = z.infer<typeof updateStudentSchema>;
