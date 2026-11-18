import { z } from 'zod';

const positiveInteger = z.coerce.number().int().min(1);

export const studentsListSchema = z.object({
  page: positiveInteger.max(1_000_000).default(1),
  pageSize: positiveInteger.max(100).default(25),
}).strict();

export type StudentsListDto = z.infer<typeof studentsListSchema>;
