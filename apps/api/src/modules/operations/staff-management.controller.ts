import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { createStaffSchema, updateStaffSchema } from './staff.dto.js';
import type { CreateStaffDto, UpdateStaffDto } from './staff.dto.js';
import { StaffManagementService } from './staff-management.service.js';

@Controller('api/v1/staff')
@UseGuards(SessionAuthGuard)
export class StaffManagementController {
  constructor(private readonly staff: StaffManagementService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.staff.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body({ schema: createStaffSchema }) body: CreateStaffDto) {
    return this.staff.create(user.id, body);
  }

  @Patch(':staffId')
  update(@CurrentUser() user: AuthenticatedUser, @Param('staffId', { schema: z.uuid() }) staffId: string, @Body({ schema: updateStaffSchema }) body: UpdateStaffDto) {
    return this.staff.update(user.id, staffId, body);
  }

  @Post(':staffId/archive')
  archive(@CurrentUser() user: AuthenticatedUser, @Param('staffId', { schema: z.uuid() }) staffId: string) {
    return this.staff.archive(user.id, staffId);
  }
}
