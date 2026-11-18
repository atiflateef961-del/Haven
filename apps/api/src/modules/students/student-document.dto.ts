import { z } from 'zod';

export const studentDocumentIdSchema = z.uuid();
export const createStudentDocumentSchema = z.object({
  documentType: z.string().trim().min(1).max(80),
}).strict();
export type CreateStudentDocumentDto = z.infer<typeof createStudentDocumentSchema>;
