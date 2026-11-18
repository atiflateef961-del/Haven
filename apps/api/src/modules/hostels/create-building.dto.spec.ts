import { createBuildingSchema } from './create-building.dto.js';

describe('createBuildingSchema', () => {
  it('trims a valid building name', () => {
    expect(createBuildingSchema.parse({ name: ' North Wing ' })).toEqual({ name: 'North Wing' });
  });

  it('rejects blank, oversized, and unknown fields', () => {
    expect(createBuildingSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(createBuildingSchema.safeParse({ name: 'a'.repeat(121) }).success).toBe(false);
    expect(createBuildingSchema.safeParse({ name: 'North Wing', hostelId: 'untrusted' }).success).toBe(false);
  });
});
