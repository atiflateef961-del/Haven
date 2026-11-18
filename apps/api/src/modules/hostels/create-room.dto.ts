import { z } from 'zod';

export const createRoomSchema = z.object({
  number: z.string().trim().min(1).max(40),
  roomType: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().min(1).max(500).optional(),
}).strict();

export type CreateRoomDto = z.infer<typeof createRoomSchema>;
