import { updateStudentSelfSchema } from './update-student-self.dto.js';

describe('updateStudentSelfSchema', () => {
  it('accepts contact changes and nullable values for clearing', () => {
    expect(updateStudentSelfSchema.parse({ email: ' student@example.com ', phone: null }))
      .toEqual({ email: 'student@example.com', phone: null });
  });

  it('rejects empty updates, malformed contacts, and protected profile fields', () => {
    expect(updateStudentSelfSchema.safeParse({}).success).toBe(false);
    expect(updateStudentSelfSchema.safeParse({ email: 'bad' }).success).toBe(false);
    expect(updateStudentSelfSchema.safeParse({ studentNumber: 'CHANGED' }).success).toBe(false);
  });
});
