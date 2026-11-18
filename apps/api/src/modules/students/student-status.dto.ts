import { z } from 'zod';

export const studentStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'GRADUATED',
  'PROBATION',
  'LEAVE_OF_ABSENCE',
]);
