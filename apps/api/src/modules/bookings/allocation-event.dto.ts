import { z } from 'zod';

export const allocationIdSchema = z.uuid();
export const allocationEventSchema = z.object({ notes: z.string().trim().max(1000).optional() }).strict();
export type AllocationEventDto = z.infer<typeof allocationEventSchema>;
export const transferAllocationSchema = z.object({ bedId: z.uuid() }).strict();
export type TransferAllocationDto = z.infer<typeof transferAllocationSchema>;
