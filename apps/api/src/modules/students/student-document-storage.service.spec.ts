import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { StudentDocumentStorageService } from './student-document-storage.service.js';

describe('StudentDocumentStorageService', () => {
  let directory: string;
  let storage: StudentDocumentStorageService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'hms-student-documents-'));
    storage = new StudentDocumentStorageService({
      get: () => directory,
    } as never);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes files with generated names and reads/removes only generated object keys', async () => {
    const contents = Buffer.from('%PDF-1.7 private record');
    const objectKey = await storage.write(contents, 'pdf');
    expect(objectKey).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    await expect(storage.read(objectKey)).resolves.toEqual(contents);
    await storage.remove(objectKey);
    await expect(storage.read(objectKey)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restores a generated key after a database failure recovery', async () => {
    const contents = Buffer.from('%PDF-1.7 private record');
    const objectKey = await storage.write(contents, 'pdf');
    await storage.remove(objectKey);
    await storage.restore(objectKey, contents);
    await expect(storage.read(objectKey)).resolves.toEqual(contents);
  });

  it.each(['../secret.pdf', 'student.pdf', '00000000-0000-4000-8000-000000000000.exe'])(
    'rejects unsafe object key %s', async (objectKey) => {
      await expect(storage.read(objectKey)).rejects.toBeInstanceOf(NotFoundException);
    },
  );
});
