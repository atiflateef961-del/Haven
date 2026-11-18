import { registerSchema } from './register.dto.js';

describe('registerSchema', () => {
  const valid = {
    fullName: 'Avery Resident',
    email: 'avery@example.com',
    password: 'long-enough-password',
    confirmPassword: 'long-enough-password',
  };

  it('accepts valid registration details and trims name and email', () => {
    expect(registerSchema.parse({ ...valid, fullName: ' Avery Resident ', email: ' avery@example.com ' })).toMatchObject({
      fullName: 'Avery Resident', email: 'avery@example.com',
    });
  });

  it.each([
    [{ ...valid, email: 'bad-email' }],
    [{ ...valid, fullName: '  ' }],
    [{ ...valid, password: 'short', confirmPassword: 'short' }],
    [{ ...valid, confirmPassword: 'a different password' }],
    [{ ...valid, extra: 'not allowed' }],
  ])('rejects invalid registration details', (payload) => {
    expect(registerSchema.safeParse(payload).success).toBe(false);
  });
});
