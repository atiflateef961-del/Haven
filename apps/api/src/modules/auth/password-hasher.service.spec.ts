import { PasswordHasher } from './password-hasher.service.js';

describe('PasswordHasher', () => {
  const passwordHasher = new PasswordHasher();

  it('creates a salted Argon2id hash that verifies the original password', async () => {
    const hash = await passwordHasher.hash('correct horse battery staple');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('correct horse battery staple');
    await expect(
      passwordHasher.verify(hash, 'correct horse battery staple'),
    ).resolves.toBe(true);
  });

  it('rejects a different password and malformed stored hashes', async () => {
    const hash = await passwordHasher.hash('correct horse battery staple');

    await expect(passwordHasher.verify(hash, 'incorrect password')).resolves.toBe(
      false,
    );
    await expect(passwordHasher.verify('not-a-hash', 'anything')).resolves.toBe(
      false,
    );
  });
});
