import { updateFloorSchema } from './update-floor.dto.js';

describe('updateFloorSchema', () => {
  it('accepts integer floor numbers including basement and ground levels', () => {
    expect(updateFloorSchema.parse({ number: -1 })).toEqual({ number: -1 });
    expect(updateFloorSchema.parse({ number: 0 })).toEqual({ number: 0 });
  });

  it('rejects non-integers and unknown fields', () => {
    expect(updateFloorSchema.safeParse({ number: 1.25 }).success).toBe(false);
    expect(updateFloorSchema.safeParse({ number: 1, buildingId: 'untrusted' }).success).toBe(false);
  });
});
