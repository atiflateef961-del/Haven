import { createFloorSchema } from './create-floor.dto.js';

describe('createFloorSchema', () => {
  it.each([-1, 0, 1])('accepts floor number %i', (number) => {
    expect(createFloorSchema.parse({ number })).toEqual({ number });
  });

  it('rejects fractional, out-of-range, string, and unknown values', () => {
    expect(createFloorSchema.safeParse({ number: 1.5 }).success).toBe(false);
    expect(createFloorSchema.safeParse({ number: 2_147_483_648 }).success).toBe(false);
    expect(createFloorSchema.safeParse({ number: '1' }).success).toBe(false);
    expect(createFloorSchema.safeParse({ number: 1, buildingId: 'untrusted' }).success).toBe(false);
  });
});
