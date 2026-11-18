import { z } from 'zod';

export const bookingIdSchema = z.uuid();
export const approveBookingSchema = z.object({ bedId: z.uuid() }).strict();
export type ApproveBookingDto = z.infer<typeof approveBookingSchema>;
