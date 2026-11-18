import { environmentSchema } from './environment.schema.js';

describe('environmentSchema', () => {
  it('provides safe development defaults', () => {
    expect(environmentSchema.parse({ DATABASE_URL: 'postgresql://localhost/test' })).toEqual({
      NODE_ENV: 'development',
      PORT: 4000,
      DATABASE_URL: 'postgresql://localhost/test',
      DEFAULT_SIGNUP_ROLE: 'HOSTEL_ADMIN',
      WEB_ORIGIN: undefined,
      STUDENT_DOCUMENT_STORAGE_DIR: undefined,
      STUDENT_DOCUMENT_SCANNER_PATH: undefined,
      EMAIL_API_KEY: undefined,
      EMAIL_FROM: undefined,
      EMAIL_API_URL: 'https://api.resend.com/emails',
      PAYMENT_WEBHOOK_SECRET: undefined,
    });
  });

  it('requires a configured browser origin in production', () => {
    expect(() =>
      environmentSchema.parse({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost/test',
        STUDENT_DOCUMENT_STORAGE_DIR: 'D:\\hms-private-documents',
      }),
    ).toThrow();
    expect(() =>
      environmentSchema.parse({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost/test',
        WEB_ORIGIN: 'https://hostel.example.com/app',
        STUDENT_DOCUMENT_STORAGE_DIR: 'D:\\hms-private-documents',
      }),
    ).toThrow();
  });

  it('requires a PostgreSQL database URL', () => {
    expect(() => environmentSchema.parse({})).toThrow();
    expect(() =>
      environmentSchema.parse({ DATABASE_URL: 'https://example.com/db' }),
    ).toThrow();
  });

  it('requires an absolute private document storage directory in production', () => {
    expect(() => environmentSchema.parse({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/test',
      WEB_ORIGIN: 'https://hostel.example.com',
      STUDENT_DOCUMENT_STORAGE_DIR: 'private/documents',
    })).toThrow();
    expect(environmentSchema.parse({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/test',
      WEB_ORIGIN: 'https://hostel.example.com',
      STUDENT_DOCUMENT_STORAGE_DIR: 'D:\\hms-private-documents',
      STUDENT_DOCUMENT_SCANNER_PATH: 'D:\\ClamAV\\clamscan.exe',
      PAYMENT_WEBHOOK_SECRET: 'x'.repeat(32),
    }).STUDENT_DOCUMENT_STORAGE_DIR).toBe('D:\\hms-private-documents');
    expect(() => environmentSchema.parse({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://localhost/test',
      WEB_ORIGIN: 'https://hostel.example.com',
      STUDENT_DOCUMENT_STORAGE_DIR: 'D:\\hms-private-documents',
      STUDENT_DOCUMENT_SCANNER_PATH: 'clamscan',
      PAYMENT_WEBHOOK_SECRET: 'x'.repeat(32),
    })).toThrow();
  });

  it('coerces a valid port string to a number', () => {
    expect(
      environmentSchema.parse({
        PORT: '4500',
        DATABASE_URL: 'postgresql://localhost/test',
      }).PORT,
    ).toBe(4500);
  });

  it.each(['0', '65536', 'not-a-port'])('rejects invalid port %s', (PORT) => {
    expect(() => environmentSchema.parse({ PORT })).toThrow();
  });

  it('rejects an unsupported runtime environment', () => {
    expect(() =>
      environmentSchema.parse({ NODE_ENV: 'staging' }),
    ).toThrow();
  });
});
