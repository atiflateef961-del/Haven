import { z } from 'zod';
import { studentStatusSchema } from './student-status.dto.js';

const optionalEmail = z.string().trim().email().max(320).optional();
const optionalPhone = z.string().trim().min(1).max(32).optional();
const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional();

export const createStudentSchema = z.object({
  organizationId: z.uuid().optional(),
  studentNumber: z.string().trim().min(1).max(60),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: optionalEmail,
  phone: optionalPhone,
  dateOfBirth: z.iso.date().optional(),
  educationInstitution: optionalText(180),
  educationProgram: optionalText(180),
  educationYear: optionalText(40),
  status: studentStatusSchema.optional(),
}).strict();

export type CreateStudentDto = z.infer<typeof createStudentSchema>;
