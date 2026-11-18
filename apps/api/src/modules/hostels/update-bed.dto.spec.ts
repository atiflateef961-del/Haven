import { updateBedSchema } from './update-bed.dto.js';

describe('updateBedSchema', () => {
  it('trims and accepts a bed label', () => {
    expect(updateBedSchema.parse({ label: ' B ' })).toEqual({ label: 'B' });
  });

  it('accepts active-state changes', () => {
    expect(updateBedSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it('rejects blank, overlong, and unknown input', () => {
    expect(updateBedSchema.safeParse({ label: '  ' }).success).toBe(false);
    expect(updateBedSchema.safeParse({ label: 'x'.repeat(41) }).success).toBe(false);
    expect(updateBedSchema.safeParse({}).success).toBe(false);
    expect(updateBedSchema.safeParse({ label: 'B', extra: true }).success).toBe(false);
  });
});
