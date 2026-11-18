import { createBedSchema } from './create-bed.dto.js';

describe('createBedSchema', () => {
  it('trims and accepts a bounded label', () => {
    expect(createBedSchema.parse({ label: ' A ' })).toEqual({ label: 'A' });
  });

  it('rejects blank, overlong, and unknown input', () => {
    expect(createBedSchema.safeParse({ label: '  ' }).success).toBe(false);
    expect(createBedSchema.safeParse({ label: 'x'.repeat(41) }).success).toBe(false);
    expect(createBedSchema.safeParse({ label: 'A', roomId: 'forged' }).success).toBe(false);
  });
});
