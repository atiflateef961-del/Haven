import { updateStudentSchema } from './update-student.dto.js';

describe('updateStudentSchema', () => {
  it('accepts partial profile updates and explicit nullable contact clearing', () => {
    expect(updateStudentSchema.parse({
      firstName: ' Ada ', email: null, dateOfBirth: null,
      educationInstitution: ' University ', educationProgram: null, educationYear: ' Year 2 ',
      status: 'GRADUATED',
    })).toEqual({
      firstName: 'Ada', email: null, dateOfBirth: null,
      educationInstitution: 'University', educationProgram: null, educationYear: 'Year 2',
      status: 'GRADUATED',
    });
  });

  it('rejects empty updates, invalid fields, and unknown properties', () => {
    expect(updateStudentSchema.safeParse({}).success).toBe(false);
    expect(updateStudentSchema.safeParse({ firstName: ' ' }).success).toBe(false);
    expect(updateStudentSchema.safeParse({ email: 'invalid' }).success).toBe(false);
    expect(updateStudentSchema.safeParse({ organizationId: 'org-1' }).success).toBe(false);
  });
});
