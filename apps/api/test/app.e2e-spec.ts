import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { AppModule } from './../src/app.module.js';
import { configureHttpSecurity } from './../src/config/http-security.js';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App> & NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    configureHttpSecurity(app, 'http://localhost:3000');
    await app.init();
  });

  it('/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('rejects a cross-origin logout request', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'https://attacker.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);
  });

  it('allows logout from the configured frontend origin', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(200)
      .expect({ status: 'ok' })
      .expect('set-cookie', /hms_session=;/);
  });

  it('requires a session cookie to read the current user', () => {
    return request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
  });

  it('requires a session cookie to read dashboard data', () => {
    return request(app.getHttpServer())
      .get('/api/v1/dashboard/summary')
      .expect(401);
  });

  it('requires a session cookie to list students', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students')
      .expect(401);
  });

  it('requires a session cookie to read the signed-in student profile', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/me')
      .expect(401);
  });

  it('requires a session cookie to read the signed-in student room history', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/me/room-history')
      .expect(401);
  });

  it('requires a session cookie to update the signed-in student profile', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/students/me')
      .send({ phone: '12345' })
      .expect(401);
  });

  it('requires a session cookie to create a booking for the signed-in student', () => {
    return request(app.getHttpServer())
      .post('/api/v1/students/me/bookings')
      .send({ requestedFrom: '2027-01-10', requestedUntil: '2027-02-01' })
      .expect(401);
  });

  it('requires a session cookie to list bookings for the signed-in student', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/me/bookings')
      .expect(401);
  });

  it('requires a session cookie to cancel a booking for the signed-in student', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/students/me/bookings/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/cancel')
      .expect(401);
  });

  it('requires a session cookie to list booking requests', () => {
    return request(app.getHttpServer())
      .get('/api/v1/bookings')
      .expect(401);
  });

  it('requires a session cookie to approve a booking request', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/bookings/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/approve')
      .send({ bedId: 'e91db84a-4bcb-4be9-aae0-7f07f1e99a36' })
      .expect(401);
  });

  it('requires a session cookie to list beds for a booking request', () => {
    return request(app.getHttpServer())
      .get('/api/v1/bookings/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/available-beds')
      .expect(401);
  });

  it('requires a session cookie to check a student in', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/bookings/allocations/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/check-in')
      .send({})
      .expect(401);
  });

  it('requires a session cookie to check a student out', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/bookings/allocations/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/check-out')
      .send({})
      .expect(401);
  });

  it('requires a session cookie to transfer an active allocation', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/bookings/allocations/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/transfer')
      .send({ bedId: 'e91db84a-4bcb-4be9-aae0-7f07f1e99a36' })
      .expect(401);
  });

  it('requires a session cookie to create an invoice', () => {
    return request(app.getHttpServer())
      .post('/api/v1/invoices')
      .send({ studentId: 'e91db84a-4bcb-4be9-aae0-7f07f1e99a35', number: 'INV-1', items: [{ description: 'Fee', quantity: 1, unitAmount: '10.00' }] })
      .expect(401);
  });

  it('requires a session cookie to issue an invoice', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/invoices/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/issue')
      .expect(401);
  });

  it('requires a session cookie to list invoices', () => {
    return request(app.getHttpServer())
      .get('/api/v1/invoices')
      .expect(401);
  });

  it('requires a session cookie to read invoice details', () => {
    return request(app.getHttpServer())
      .get('/api/v1/invoices/e91db84a-4bcb-4be9-aae0-7f07f1e99a35')
      .expect(401);
  });

  it('requires a session cookie to record an offline invoice payment', () => {
    return request(app.getHttpServer())
      .post('/api/v1/invoices/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/payments/offline')
      .send({ amount: '10.00', method: 'CASH' })
      .expect(401);
  });

  it('requires a session cookie to reject a booking request', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/bookings/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/reject')
      .expect(401);
  });

  it('requires a session cookie to create a student', () => {
    return request(app.getHttpServer())
      .post('/api/v1/students')
      .send({ studentNumber: 'S-100', firstName: 'Ada', lastName: 'Lovelace' })
      .expect(401);
  });

  it('requires a session cookie to update a student', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35')
      .send({ firstName: 'Ada' })
      .expect(401);
  });

  it('requires a session cookie to list student guardians', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/guardians')
      .expect(401);
  });

  it('requires a session cookie to create a student guardian', () => {
    return request(app.getHttpServer())
      .post('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/guardians')
      .send({ name: 'Parent', phone: '12345' })
      .expect(401);
  });

  it('requires a session cookie to update a student guardian', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/guardians/e91db84a-4bcb-4be9-aae0-7f07f1e99a36')
      .send({ phone: '12345' })
      .expect(401);
  });

  it('requires a session cookie to list student documents', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/documents')
      .expect(401);
  });

  it('requires a session cookie to list student room history', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/room-history')
      .expect(401);
  });

  it('requires a session cookie to upload student documents', () => {
    return request(app.getHttpServer())
      .post('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/documents')
      .field('documentType', 'identity')
      .expect(401);
  });

  it('requires a session cookie to download a student document', () => {
    return request(app.getHttpServer())
      .get('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/documents/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/file')
      .expect(401);
  });

  it('requires a session cookie to delete a student document', () => {
    return request(app.getHttpServer())
      .delete('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/documents/e91db84a-4bcb-4be9-aae0-7f07f1e99a36')
      .expect(401);
  });

  it('requires a session cookie to archive a student', () => {
    return request(app.getHttpServer())
      .post('/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/archive')
      .expect(401);
  });

  it('requires a session cookie to read personal notifications', () => {
    return request(app.getHttpServer())
      .get('/api/v1/dashboard/notifications')
      .expect(401);
  });

  it('requires a session cookie to list hostels', () => {
    return request(app.getHttpServer())
      .get('/api/v1/hostels')
      .expect(401);
  });

  it('requires a session cookie to create a hostel', () => {
    return request(app.getHttpServer())
      .post('/api/v1/hostels')
      .send({ name: 'North Hall', code: 'NH-1' })
      .expect(401);
  });

  it('requires a session cookie to edit a hostel', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35')
      .send({ name: 'Renamed Hall' })
      .expect(401);
  });

  it('requires a session cookie to archive a hostel', () => {
    return request(app.getHttpServer())
      .post('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/archive')
      .expect(401);
  });

  it('requires a session cookie to list buildings', () => {
    return request(app.getHttpServer())
      .get('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings')
      .expect(401);
  });

  it('requires a session cookie to create a building', () => {
    return request(app.getHttpServer())
      .post('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings')
      .send({ name: 'North Wing' })
      .expect(401);
  });

  it('requires a session cookie to update a building', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36')
      .send({ name: 'Renamed Wing' })
      .expect(401);
  });

  it('requires a session cookie to list floors', () => {
    return request(app.getHttpServer())
      .get('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors')
      .expect(401);
  });

  it('requires a session cookie to create a floor', () => {
    return request(app.getHttpServer())
      .post('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors')
      .send({ number: 1 })
      .expect(401);
  });

  it('requires a session cookie to update a floor', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors/e91db84a-4bcb-4be9-aae0-7f07f1e99a37')
      .send({ number: 2 })
      .expect(401);
  });

  it('requires a session cookie to list rooms', () => {
    return request(app.getHttpServer())
      .get('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors/e91db84a-4bcb-4be9-aae0-7f07f1e99a37/rooms')
      .expect(401);
  });

  it('requires a session cookie to create a room', () => {
    return request(app.getHttpServer())
      .post('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors/e91db84a-4bcb-4be9-aae0-7f07f1e99a37/rooms')
      .send({ number: '101' })
      .expect(401);
  });

  it('requires a session cookie to update a room', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors/e91db84a-4bcb-4be9-aae0-7f07f1e99a37/rooms/e91db84a-4bcb-4be9-aae0-7f07f1e99a38')
      .send({ number: '102' })
      .expect(401);
  });

  it('requires a session cookie to archive a room', () => {
    return request(app.getHttpServer())
      .post('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors/e91db84a-4bcb-4be9-aae0-7f07f1e99a37/rooms/e91db84a-4bcb-4be9-aae0-7f07f1e99a38/archive')
      .expect(401);
  });

  it('requires a session cookie to list beds', () => {
    return request(app.getHttpServer())
      .get('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors/e91db84a-4bcb-4be9-aae0-7f07f1e99a37/rooms/e91db84a-4bcb-4be9-aae0-7f07f1e99a38/beds')
      .expect(401);
  });

  it('requires a session cookie to list beds on a floor', () => {
    return request(app.getHttpServer())
      .get('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors/e91db84a-4bcb-4be9-aae0-7f07f1e99a37/beds')
      .expect(401);
  });

  it('requires a session cookie to create a bed', () => {
    return request(app.getHttpServer())
      .post('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors/e91db84a-4bcb-4be9-aae0-7f07f1e99a37/rooms/e91db84a-4bcb-4be9-aae0-7f07f1e99a38/beds')
      .send({ label: 'A' })
      .expect(401);
  });

  it('requires a session cookie to update a bed', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/buildings/e91db84a-4bcb-4be9-aae0-7f07f1e99a36/floors/e91db84a-4bcb-4be9-aae0-7f07f1e99a37/rooms/e91db84a-4bcb-4be9-aae0-7f07f1e99a38/beds/e91db84a-4bcb-4be9-aae0-7f07f1e99a39')
      .send({ label: 'B' })
      .expect(401);
  });

  it('requires a session cookie to archive a hostel', () => {
    return request(app.getHttpServer())
      .post('/api/v1/hostels/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/archive')
      .expect(401);
  });

  it('requires an active session before rotating a session token', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/rotate')
      .set('Origin', 'http://localhost:3000')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(401);
  });

  it('validates password-reset completion input before accessing a token', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/password-reset/complete')
      .set('Origin', 'http://localhost:3000')
      .send({ token: 'bad', newPassword: 'short' })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
