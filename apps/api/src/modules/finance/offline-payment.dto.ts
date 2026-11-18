import { z } from 'zod';

export const recordOfflinePaymentSchema = z.object({
  amount: z.string().regex(/^[1-9]\d{0,9}\.\d{2}$/),
  method: z.enum(['CASH', 'BANK_TRANSFER']),
}).strict();
export type RecordOfflinePaymentDto = z.infer<typeof recordOfflinePaymentSchema>;
