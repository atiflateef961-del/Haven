import { createRoomSchema } from './create-room.dto.js';

describe('createRoomSchema', () => {
  it('trims room number, type, and description', () => {
    expect(createRoomSchema.parse({ number: ' 101 ', roomType: ' Double ', description: ' East wing ' }))
      .toEqual({ number: '101', roomType: 'Double', description: 'East wing' });
  });

  it('accepts the required number without optional details', () => {
    expect(createRoomSchema.parse({ number: 'A-12' })).toEqual({ number: 'A-12' });
  });

  it('rejects blank numbers, oversized fields, and unknown properties', () => {
    expect(createRoomSchema.safeParse({ number: '  ' }).success).toBe(false);
    expect(createRoomSchema.safeParse({ number: 'x'.repeat(41) }).success).toBe(false);
    expect(createRoomSchema.safeParse({ number: '101', hostelId: 'untrusted' }).success).toBe(false);
  });
});
