import { updateRoomSchema } from './update-room.dto.js';

describe('updateRoomSchema', () => {
  it('trims values and permits clearing nullable details', () => {
    expect(updateRoomSchema.parse({ number: ' 102 ', roomType: null, description: '  New details ' }))
      .toEqual({ number: '102', roomType: null, description: 'New details' });
  });

  it('requires at least one supported field', () => {
    expect(updateRoomSchema.safeParse({}).success).toBe(false);
  });

  it('rejects blank, oversized, and unknown values', () => {
    expect(updateRoomSchema.safeParse({ roomType: '  ' }).success).toBe(false);
    expect(updateRoomSchema.safeParse({ description: 'x'.repeat(501) }).success).toBe(false);
    expect(updateRoomSchema.safeParse({ number: '102', floorId: 'untrusted' }).success).toBe(false);
  });
});
