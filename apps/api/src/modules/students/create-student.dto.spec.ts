import { createStudentSchema } from './create-student.dto.js';

describe('createStudentSchema', () => {
  it('trims and validates student profile fields', () => {
    expect(createStudentSchema.parse({
      organizationId: 'e91db84a-4bcb-4be9-aae0-7f07f1e99a35',
      studentNumber: ' S-100 ',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      email: ' ada@example.com ',
      phone: ' 12345 ',
      dateOfBirth: '2000-01-02',
      educationInstitution: ' Example University ',
      educationProgram: ' Computer Science ',
      educationYear: ' Year 2 ',
      status: 'SUSPENDED',
    })).toMatchObject({
      studentNumber: 'S-100', firstName: 'Ada', lastName: 'Lovelace',
      email: 'ada@example.com', phone: '12345',
      educationInstitution: 'Example University', educationProgram: 'Computer Science', educationYear: 'Year 2',
      status: 'SUSPENDED',
    });
  });

  it('rejects empty names, malformed contact details, invalid dates, and unknown fields', () => {
    expect(createStudentSchema.safeParse({ studentNumber: ' ', firstName: 'A', lastName: 'B' }).success).toBe(false);
    expect(createStudentSchema.safeParse({ studentNumber: '1', firstName: 'A', lastName: 'B', email: 'bad' }).success).toBe(false);
    expect(createStudentSchema.safeParse({ studentNumber: '1', firstName: 'A', lastName: 'B', dateOfBirth: '2026-02-30' }).success).toBe(false);
    expect(createStudentSchema.safeParse({ studentNumber: '1', firstName: 'A', lastName: 'B', userId: 'ignored' }).success).toBe(false);
    expect(createStudentSchema.safeParse({ studentNumber: '1', firstName: 'A', lastName: 'B', status: 'ARCHIVED' }).success).toBe(false);
  });
});
