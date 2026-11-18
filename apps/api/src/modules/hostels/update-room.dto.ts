import { z } from 'zod';

export const updateRoomSchema = z.object({
  number: z.string().trim().min(1).max(40).optional(),
  roomType: z.string().trim().min(1).max(60).nullable().optional(),
  description: z.string().trim().min(1).max(500).nullable().optional(),
}).strict().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: 'At least one room field must be provided',
});

export type UpdateRoomDto = z.infer<typeof updateRoomSchema>;

export const roomIdSchema = z.string().uuid();
