import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';
import { StudentDocumentStorageService } from './student-document-storage.service.js';
import { StudentDocumentScannerService } from './student-document-scanner.service.js';

@Module({
  imports: [AuthModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentDocumentStorageService, StudentDocumentScannerService],
})
export class StudentsModule {}
