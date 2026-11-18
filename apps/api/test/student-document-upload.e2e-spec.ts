import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { configureHttpSecurity } from '../src/config/http-security.js';
import { SessionService } from '../src/modules/auth/session.service.js';
import { StudentsController } from '../src/modules/students/students.controller.js';
import { StudentsService } from '../src/modules/students/students.service.js';

describe('Student document upload boundary (e2e)', () => {
  let app: INestApplication<App> & NestExpressApplication;
  const uploadDocumentForUser = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    uploadDocumentForUser.mockResolvedValue({
      id: 'document-1', documentType: 'identity', contentType: 'application/pdf', createdAt: new Date(),
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
      controllers: [StudentsController],
      providers: [
        { provide: StudentsService, useValue: { uploadDocumentForUser } },
        { provide: SessionService, useValue: { findActive: async () => ({ user: { id: 'admin-1', email: 'admin@example.com' } }) } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    configureHttpSecurity(app, 'http://localhost:3000');
    await app.init();
  });

  afterEach(async () => { if (app) await app.close(); });

  const endpoint = '/api/v1/students/e91db84a-4bcb-4be9-aae0-7f07f1e99a35/documents';

  it('rejects files that exceed the 5 MiB limit before calling the service', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Cookie', 'hms_session=session-token')
      .field('documentType', 'identity')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.pdf', contentType: 'application/pdf' })
      .expect(413);
    expect(uploadDocumentForUser).not.toHaveBeenCalled();
  });

  it('rejects requests without the required file before calling the service', async () => {
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Cookie', 'hms_session=session-token')
      .field('documentType', 'identity')
      .expect(400);
    expect(uploadDocumentForUser).not.toHaveBeenCalled();
  });

  it('accepts a bounded multipart file and passes it to the upload service', async () => {
    const contents = Buffer.from('%PDF-1.7 safe test fixture');
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Cookie', 'hms_session=session-token')
      .field('documentType', 'identity')
      .attach('file', contents, { filename: 'identity.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(uploadDocumentForUser).toHaveBeenCalledWith('admin-1', 'e91db84a-4bcb-4be9-aae0-7f07f1e99a35', 'identity', expect.objectContaining({
      buffer: contents,
      mimetype: 'application/pdf',
    }));
  });
});
