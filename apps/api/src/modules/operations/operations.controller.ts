import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { OperationsService } from './operations.service.js';
import { createVisitorSchema } from './visitor.dto.js';
import type { CreateVisitorDto } from './visitor.dto.js';
import { createComplaintSchema, updateComplaintSchema } from './complaint.dto.js';
import type { CreateComplaintDto, UpdateComplaintDto } from './complaint.dto.js';
import { createMaintenanceSchema, updateMaintenanceSchema } from './maintenance.dto.js';
import type { CreateMaintenanceDto, UpdateMaintenanceDto } from './maintenance.dto.js';
import { createMessScheduleSchema, markMealAttendanceSchema, updateMessScheduleSchema } from './mess.dto.js';
import type { CreateMessScheduleDto, UpdateMessScheduleDto } from './mess.dto.js';

@Controller('api/v1/visitors')
@UseGuards(SessionAuthGuard)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.operations.listVisitors(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body({ schema: createVisitorSchema }) body: CreateVisitorDto) {
    return this.operations.createVisitor(user.id, body);
  }
}

@Controller('api/v1/complaints')
@UseGuards(SessionAuthGuard)
export class ComplaintsController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.operations.listComplaints(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body({ schema: createComplaintSchema }) body: CreateComplaintDto) {
    return this.operations.createComplaint(user.id, body);
  }

  @Patch(':complaintId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('complaintId', { schema: z.uuid() }) complaintId: string,
    @Body({ schema: updateComplaintSchema }) body: UpdateComplaintDto,
  ) {
    return this.operations.updateComplaint(user.id, complaintId, body);
  }
}

@Controller('api/v1/maintenance')
@UseGuards(SessionAuthGuard)
export class MaintenanceController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.operations.listMaintenance(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body({ schema: createMaintenanceSchema }) body: CreateMaintenanceDto) {
    return this.operations.createMaintenance(user.id, body);
  }

  @Patch(':requestId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', { schema: z.uuid() }) requestId: string,
    @Body({ schema: updateMaintenanceSchema }) body: UpdateMaintenanceDto,
  ) {
    return this.operations.updateMaintenance(user.id, requestId, body);
  }
}

@Controller('api/v1/mess-schedules')
@UseGuards(SessionAuthGuard)
export class MessController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.operations.listMess(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body({ schema: createMessScheduleSchema }) body: CreateMessScheduleDto) {
    return this.operations.createMessSchedule(user.id, body);
  }

  @Patch(':scheduleId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', { schema: z.uuid() }) scheduleId: string,
    @Body({ schema: updateMessScheduleSchema }) body: UpdateMessScheduleDto,
  ) {
    return this.operations.updateMessSchedule(user.id, scheduleId, body);
  }

  @Post(':scheduleId/attendance')
  markAttendance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scheduleId', { schema: z.uuid() }) scheduleId: string,
    @Body({ schema: markMealAttendanceSchema }) body: { studentId: string },
  ) {
    return this.operations.markMealAttendance(user.id, scheduleId, body.studentId);
  }
}
