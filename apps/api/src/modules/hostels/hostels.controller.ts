import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { createHostelSchema } from './create-hostel.dto.js';
import type { CreateHostelDto } from './create-hostel.dto.js';
import { hostelIdSchema, updateHostelSchema } from './update-hostel.dto.js';
import type { UpdateHostelDto } from './update-hostel.dto.js';
import { HostelsService } from './hostels.service.js';

@Controller('api/v1/hostels')
@UseGuards(SessionAuthGuard)
export class HostelsController {
  constructor(private readonly hostelsService: HostelsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.hostelsService.listForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: createHostelSchema }) body: CreateHostelDto,
  ) {
    return this.hostelsService.createForUser(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', { schema: hostelIdSchema }) id: string,
    @Body({ schema: updateHostelSchema }) body: UpdateHostelDto,
  ) {
    return this.hostelsService.updateForUser(user.id, id, body);
  }

  @Post(':id/archive')
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', { schema: hostelIdSchema }) id: string,
  ) {
    return this.hostelsService.archiveForUser(user.id, id);
  }
}
