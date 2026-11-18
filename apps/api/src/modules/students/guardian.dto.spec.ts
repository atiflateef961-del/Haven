import { createGuardianSchema, updateGuardianSchema } from './guardian.dto.js';

describe('createGuardianSchema', () => {
  it('trims required fields and validates optional contact details', () => {
    expect(createGuardianSchema.parse({
      name: ' Parent Name ', relationship: ' Mother ', email: ' parent@example.com ', phone: ' 12345 ',
    })).toEqual({ name: 'Parent Name', relationship: 'Mother', email: 'parent@example.com', phone: '12345' });
  });

  it('rejects missing, malformed, or unknown fields', () => {
    expect(createGuardianSchema.safeParse({ name: 'Parent' }).success).toBe(false);
    expect(createGuardianSchema.safeParse({ name: 'Parent', phone: ' ', email: 'bad' }).success).toBe(false);
    expect(createGuardianSchema.safeParse({ name: 'Parent', phone: '123', studentId: 'another-id' }).success).toBe(false);
  });
});

describe('updateGuardianSchema', () => {
  it('accepts partial changes and explicit nullable fields', () => {
    expect(updateGuardianSchema.parse({ email: null, relationship: null }))
      .toEqual({ email: null, relationship: null });
  });

  it('rejects empty changes and unknown properties', () => {
    expect(updateGuardianSchema.safeParse({}).success).toBe(false);
    expect(updateGuardianSchema.safeParse({ studentId: 'another-student' }).success).toBe(false);
  });
});
