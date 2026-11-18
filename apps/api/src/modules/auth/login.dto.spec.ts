import { loginSchema } from './login.dto.js';

describe('loginSchema', () => {
  it('trims email and accepts a valid login payload', () => {
    expect(
      loginSchema.parse({ email: '  user@example.com ', password: 'secret' }),
    ).toEqual({ email: 'user@example.com', password: 'secret' });
  });

  it.each([
    { email: 'not-an-email', password: 'secret' },
    { email: 'user@example.com', password: '' },
    { email: 'user@example.com', password: 'x'.repeat(1025) },
    { email: 'user@example.com', password: 'secret', role: 'ADMIN' },
  ])('rejects invalid or over-posted login data', (payload) => {
    expect(loginSchema.safeParse(payload).success).toBe(false);
  });
});
