import { updateBuildingSchema } from './update-building.dto.js';

describe('updateBuildingSchema', () => {
  it('trims the updated building name', () => {
    expect(updateBuildingSchema.parse({ name: ' North Wing ' })).toEqual({ name: 'North Wing' });
  });

  it('requires a name and rejects unknown fields', () => {
    expect(updateBuildingSchema.safeParse({}).success).toBe(false);
    expect(updateBuildingSchema.safeParse({ name: 'North Wing', hostelId: 'untrusted' }).success).toBe(false);
  });
});
