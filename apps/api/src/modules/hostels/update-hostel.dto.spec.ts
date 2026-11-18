import { hostelIdSchema, updateHostelSchema } from './update-hostel.dto.js';

describe('updateHostelSchema', () => {
  it('accepts partial updates and a null address to clear it', () => {
    expect(updateHostelSchema.safeParse({ name: 'New name' }).success).toBe(true);
    expect(updateHostelSchema.safeParse({ address: null }).success).toBe(true);
  });

  it('requires at least one editable field and rejects unknown fields', () => {
    expect(updateHostelSchema.safeParse({}).success).toBe(false);
    expect(updateHostelSchema.safeParse({ organizationId: 'org-1' }).success).toBe(false);
  });

  it('validates names, codes, and route IDs', () => {
    expect(updateHostelSchema.safeParse({ name: ' ' }).success).toBe(false);
    expect(updateHostelSchema.safeParse({ code: 'bad code' }).success).toBe(false);
    expect(hostelIdSchema.safeParse('hostel-1').success).toBe(false);
    expect(hostelIdSchema.safeParse('e91db84a-4bcb-4be9-aae0-7f07f1e99a35').success).toBe(true);
  });
});
