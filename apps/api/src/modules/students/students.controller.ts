import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, StreamableFile, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { StudentsService } from './students.service.js';
import { studentsListSchema } from './students-list.dto.js';
import type { StudentsListDto } from './students-list.dto.js';
import { createStudentSchema } from './create-student.dto.js';
import type { CreateStudentDto } from './create-student.dto.js';
import { studentIdSchema, updateStudentSchema } from './update-student.dto.js';
import type { UpdateStudentDto } from './update-student.dto.js';
import { createGuardianSchema, guardianIdSchema, updateGuardianSchema } from './guardian.dto.js';
import type { CreateGuardianDto } from './guardian.dto.js';
import type { UpdateGuardianDto } from './guardian.dto.js';
import { updateStudentSelfSchema } from './update-student-self.dto.js';
import type { UpdateStudentSelfDto } from './update-student-self.dto.js';
import { createStudentDocumentSchema, studentDocumentIdSchema } from './student-document.dto.js';
import type { CreateStudentDocumentDto } from './student-document.dto.js';
import { createStudentBookingSchema } from './create-student-booking.dto.js';
import type { CreateStudentBookingDto } from './create-student-booking.dto.js';
import { bookingIdSchema } from '../bookings/approve-booking.dto.js';
import { attendanceSchema } from './attendance.dto.js';
import type { AttendanceDto } from './attendance.dto.js';

type UploadedDocument = { buffer: Buffer; mimetype: string };
const maximumDocumentBytes = 5 * 1024 * 1024;

@Controller('api/v1/students')
@UseGuards(SessionAuthGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getMyProfile(user.id);
  }

  @Patch('me')
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: updateStudentSelfSchema }) body: UpdateStudentSelfDto,
  ) {
    return this.studentsService.updateMyProfile(user.id, body);
  }

  @Post('me/bookings')
  createMyBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: createStudentBookingSchema }) body: CreateStudentBookingDto,
  ) {
    return this.studentsService.createMyBooking(user.id, body);
  }

  @Get('me/bookings')
  listMyBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query({ schema: studentsListSchema }) query: StudentsListDto,
  ) {
    return this.studentsService.listMyBookings(user.id, query);
  }

  @Patch('me/bookings/:bookingId/cancel')
  cancelMyBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', { schema: bookingIdSchema }) bookingId: string,
  ) {
    return this.studentsService.cancelMyBooking(user.id, bookingId);
  }

  @Get('me/room-history')
  getMyRoomHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getMyRoomHistory(user.id);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query({ schema: studentsListSchema }) query: StudentsListDto,
  ) {
    return this.studentsService.listForUser(user.id, query);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: createStudentSchema }) body: CreateStudentDto,
  ) {
    return this.studentsService.createForUser(user.id, body);
  }

  @Patch(':studentId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
    @Body({ schema: updateStudentSchema }) body: UpdateStudentDto,
  ) {
    return this.studentsService.updateForUser(user.id, studentId, body);
  }

  @Post(':studentId/attendance')
  markAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
    @Body({ schema: attendanceSchema }) body: AttendanceDto,
  ) {
    return this.studentsService.markAttendanceForUser(user.id, studentId, body);
  }

  @Get(':studentId/guardians')
  listGuardians(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
  ) {
    return this.studentsService.listGuardiansForUser(user.id, studentId);
  }

  @Post(':studentId/guardians')
  createGuardian(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
    @Body({ schema: createGuardianSchema }) body: CreateGuardianDto,
  ) {
    return this.studentsService.createGuardianForUser(user.id, studentId, body);
  }

  @Get(':studentId/documents')
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
  ) {
    return this.studentsService.listDocumentsForUser(user.id, studentId);
  }

  @Get(':studentId/room-history')
  listRoomHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
  ) {
    return this.studentsService.listRoomHistoryForUser(user.id, studentId);
  }

  @Post(':studentId/documents')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: maximumDocumentBytes, files: 1, fields: 1, parts: 2 },
  }))
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
    @Body({ schema: createStudentDocumentSchema }) body: CreateStudentDocumentDto,
    @UploadedFile() file: UploadedDocument | undefined,
  ) {
    if (!file) throw new BadRequestException('A document file is required');
    return this.studentsService.uploadDocumentForUser(user.id, studentId, body.documentType, file);
  }

  @Get(':studentId/documents/:documentId/file')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async downloadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
    @Param('documentId', { schema: studentDocumentIdSchema }) documentId: string,
  ) {
    const document = await this.studentsService.readDocumentForUser(user.id, studentId, documentId);
    const extension = document.contentType === 'application/pdf' ? 'pdf'
      : document.contentType === 'image/jpeg' ? 'jpg'
        : document.contentType === 'image/png' ? 'png' : null;
    if (!extension) throw new BadRequestException('Unsupported stored document type');
    return new StreamableFile(document.buffer, {
      type: document.contentType,
      disposition: `attachment; filename="student-document.${extension}"`,
    });
  }

  @Delete(':studentId/documents/:documentId')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
    @Param('documentId', { schema: studentDocumentIdSchema }) documentId: string,
  ) {
    return this.studentsService.deleteDocumentForUser(user.id, studentId, documentId);
  }

  @Patch(':studentId/guardians/:guardianId')
  updateGuardian(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
    @Param('guardianId', { schema: guardianIdSchema }) guardianId: string,
    @Body({ schema: updateGuardianSchema }) body: UpdateGuardianDto,
  ) {
    return this.studentsService.updateGuardianForUser(user.id, studentId, guardianId, body);
  }

  @Post(':studentId/archive')
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('studentId', { schema: studentIdSchema }) studentId: string,
  ) {
    return this.studentsService.archiveForUser(user.id, studentId);
  }
}
