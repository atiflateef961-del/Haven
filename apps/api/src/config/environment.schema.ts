import { z } from 'zod';
import { isAbsolute } from 'node:path';


export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DATABASE_URL must use the PostgreSQL protocol',
    ),
  DEFAULT_SIGNUP_ROLE: z.enum(['HOSTEL_ADMIN', 'ACCOUNTANT']).default('HOSTEL_ADMIN'),
  WEB_ORIGIN: z
    .string()
    .url()
    .optional()
    .refine(
      (value) => value === undefined || new URL(value).origin === value,
      'WEB_ORIGIN must be an origin',
    ),
  STUDENT_DOCUMENT_STORAGE_DIR: z.string().trim().min(1).optional(),
  STUDENT_DOCUMENT_SCANNER_PATH: z.string().trim().min(1).optional(),
  EMAIL_API_KEY: z.string().trim().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_API_URL: z.string().url().default('https://api.resend.com/emails'),
  PAYMENT_WEBHOOK_SECRET: z.string().min(32).optional(),
}).superRefine((config, context) => {
  if (config.NODE_ENV === 'production' && !config.WEB_ORIGIN) {
    context.addIssue({
      code: 'custom',
      path: ['WEB_ORIGIN'],
      message: 'WEB_ORIGIN is required in production',
    });
  }
  if (config.NODE_ENV === 'production' && !config.STUDENT_DOCUMENT_STORAGE_DIR) {
    context.addIssue({
      code: 'custom',
      path: ['STUDENT_DOCUMENT_STORAGE_DIR'],
      message: 'STUDENT_DOCUMENT_STORAGE_DIR is required in production',
    });
  }
  if (config.STUDENT_DOCUMENT_STORAGE_DIR && !isAbsolute(config.STUDENT_DOCUMENT_STORAGE_DIR)) {
    context.addIssue({
      code: 'custom',
      path: ['STUDENT_DOCUMENT_STORAGE_DIR'],
      message: 'STUDENT_DOCUMENT_STORAGE_DIR must be an absolute path',
    });
  }
  if (config.STUDENT_DOCUMENT_SCANNER_PATH && !isAbsolute(config.STUDENT_DOCUMENT_SCANNER_PATH)) {
    context.addIssue({
      code: 'custom',
      path: ['STUDENT_DOCUMENT_SCANNER_PATH'],
      message: 'STUDENT_DOCUMENT_SCANNER_PATH must be an absolute path',
    });
  }
  if (config.NODE_ENV === 'production' && !config.STUDENT_DOCUMENT_SCANNER_PATH) {
    context.addIssue({
      code: 'custom',
      path: ['STUDENT_DOCUMENT_SCANNER_PATH'],
      message: 'STUDENT_DOCUMENT_SCANNER_PATH is required in production',
    });
  }
  if (config.NODE_ENV === 'production' && !config.PAYMENT_WEBHOOK_SECRET) {
    context.addIssue({
      code: 'custom',
      path: ['PAYMENT_WEBHOOK_SECRET'],
      message: 'PAYMENT_WEBHOOK_SECRET is required in production',
    });
  }
});
