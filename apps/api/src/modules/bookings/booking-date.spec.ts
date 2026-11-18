import { localDateStart } from './booking-date.js';

describe('localDateStart', () => {
  it.each([
    ['2027-01-10', 'America/Los_Angeles', '2027-01-10T08:00:00.000Z'],
    ['2027-07-10', 'America/Los_Angeles', '2027-07-10T07:00:00.000Z'],
    ['2027-03-14', 'America/Los_Angeles', '2027-03-14T08:00:00.000Z'],
    ['2027-11-07', 'America/Los_Angeles', '2027-11-07T07:00:00.000Z'],
    ['2027-01-10', 'Asia/Kathmandu', '2027-01-09T18:15:00.000Z'],
  ])('converts %s at the start of %s to %s', (date, timeZone, expected) => {
    expect(localDateStart(new Date(`${date}T00:00:00.000Z`), timeZone).toISOString()).toBe(expected);
  });

  it('rejects an invalid organization timezone', () => {
    expect(() => localDateStart(new Date('2027-01-10T00:00:00.000Z'), 'Not/A_Real_Zone')).toThrow();
  });
});
