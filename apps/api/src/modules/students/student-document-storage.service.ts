import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const extensions = new Set(['pdf', 'jpg', 'png']);

@Injectable()
export class StudentDocumentStorageService {
  private readonly directory: string;

  constructor(config: ConfigService) {
    this.directory = resolve(config.get<string>('STUDENT_DOCUMENT_STORAGE_DIR') ?? join(import.meta.dirname, '../../../var/private/student-documents'));
  }

  async write(buffer: Buffer, extension: 'pdf' | 'jpg' | 'png') {
    const objectKey = `${randomUUID()}.${extension}`;
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(join(this.directory, objectKey), buffer, { flag: 'wx', mode: 0o600 });
    return objectKey;
  }

  async read(objectKey: string) {
    const filePath = this.getFilePath(objectKey);
    try {
      return await readFile(filePath);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        throw new NotFoundException('Document file not found');
      }
      throw error;
    }
  }

  async remove(objectKey: string) {
    const filePath = this.getFilePath(objectKey);
    try {
      await rm(filePath);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
  }

  async restore(objectKey: string, buffer: Buffer) {
    const filePath = this.getFilePath(objectKey);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(filePath, buffer, { flag: 'wx', mode: 0o600 });
  }

  private getFilePath(objectKey: string) {
    const match = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(pdf|jpg|png)$/i.exec(objectKey);
    if (!match || !extensions.has(match[2].toLowerCase())) {
      throw new NotFoundException('Document file not found');
    }
    return join(this.directory, objectKey);
  }
}
