import { createStudentBookingSchema } from './create-student-booking.dto.js';

describe('createStudentBookingSchema', () => {
  it('accepts a valid date interval with optional end and notes', () => {
    expect(createStudentBookingSchema.safeParse({
      requestedFrom: '2027-01-10', requestedUntil: '2027-02-01', notes: 'Accessible room',
    }).success).toBe(true);
    expect(createStudentBookingSchema.safeParse({ requestedFrom: '2027-01-10' }).success).toBe(true);
  });

  it.each([
    { requestedFrom: '2027-02-01', requestedUntil: '2027-02-01' },
    { requestedFrom: '2027-02-02', requestedUntil: '2027-02-01' },
    { requestedFrom: '2027-02-30' },
    { requestedFrom: '2027-02-01', unexpected: true },
  ])('rejects invalid date ranges and unknown fields: %j', (input) => {
    expect(createStudentBookingSchema.safeParse(input).success).toBe(false);
  });
});
