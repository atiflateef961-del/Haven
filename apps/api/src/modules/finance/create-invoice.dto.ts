import { z } from 'zod';

const money = z.string().regex(/^(0|[1-9]\d{0,9})\.\d{2}$/).refine((value) => value !== '0.00');
export const createInvoiceSchema = z.object({
  studentId: z.uuid(),
  number: z.string().trim().min(1).max(60),
  dueAt: z.iso.datetime({ offset: true }).optional(),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(255),
    quantity: z.number().int().min(1).max(100000),
    unitAmount: money,
  }).strict()).min(1).max(100),
}).strict();
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export const invoiceIdSchema = z.uuid();
