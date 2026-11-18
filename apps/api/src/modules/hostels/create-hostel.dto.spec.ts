import { createHostelSchema } from './create-hostel.dto.js';

describe('createHostelSchema', () => {
  const validInput = { name: 'North Hall', code: 'NH-1' };

  it('accepts valid hostel fields and an optional organization selector', () => {
    expect(createHostelSchema.safeParse({
      ...validInput,
      organizationId: 'e91db84a-4bcb-4be9-aae0-7f07f1e99a35',
      address: '12 North Road',
    }).success).toBe(true);
  });

  it('trims the display name and validates code format and length', () => {
    expect(createHostelSchema.parse({ name: ' North Hall ', code: ' nh-1 ' }).name)
      .toBe('North Hall');
    expect(createHostelSchema.safeParse({ ...validInput, code: 'north hall' }).success)
      .toBe(false);
    expect(createHostelSchema.safeParse({ ...validInput, code: 'N'.repeat(41) }).success)
      .toBe(false);
  });

  it('rejects empty names, malformed organization IDs, and unknown fields', () => {
    expect(createHostelSchema.safeParse({ ...validInput, name: ' ' }).success).toBe(false);
    expect(createHostelSchema.safeParse({ ...validInput, organizationId: 'org-one' }).success)
      .toBe(false);
    expect(createHostelSchema.safeParse({ ...validInput, status: 'ACTIVE' }).success).toBe(false);
  });
});
