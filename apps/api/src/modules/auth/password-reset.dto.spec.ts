import { passwordResetRequestSchema, passwordResetSchema } from './password-reset.dto.js';

describe('passwordResetSchema', () => {
  const token = 'A'.repeat(43);

  it('accepts a 256-bit base64url token and a long passphrase', () => {
    expect(passwordResetSchema.safeParse({
      token,
      newPassword: 'a secure passphrase longer than fifteen',
    }).success).toBe(true);
  });

  it('rejects short passwords, malformed tokens, and unknown fields', () => {
    expect(passwordResetSchema.safeParse({ token, newPassword: 'short' }).success).toBe(false);
    expect(passwordResetSchema.safeParse({ token: 'invalid', newPassword: 'a secure passphrase longer than fifteen' }).success).toBe(false);
    expect(passwordResetSchema.safeParse({ token, newPassword: 'a secure passphrase longer than fifteen', extra: true }).success).toBe(false);
  });
});

describe('passwordResetRequestSchema', () => {
  it('accepts a valid email and rejects malformed or extra fields', () => {
    expect(passwordResetRequestSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
    expect(passwordResetRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(passwordResetRequestSchema.safeParse({ email: 'user@example.com', password: 'x' }).success).toBe(false);
  });
});
