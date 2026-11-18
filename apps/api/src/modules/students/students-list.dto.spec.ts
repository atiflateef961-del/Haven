import { studentsListSchema } from './students-list.dto.js';

describe('studentsListSchema', () => {
  it('applies safe defaults and accepts bounded pagination', () => {
    expect(studentsListSchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(studentsListSchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
  });

  it('rejects invalid pagination and unknown query values', () => {
    expect(studentsListSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(studentsListSchema.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(studentsListSchema.safeParse({ extra: 'ignored?' }).success).toBe(false);
  });
});
