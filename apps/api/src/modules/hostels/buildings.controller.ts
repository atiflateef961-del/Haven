import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { createBuildingSchema } from './create-building.dto.js';
import type { CreateBuildingDto } from './create-building.dto.js';
import { hostelIdSchema } from './update-hostel.dto.js';
import { buildingIdSchema, updateBuildingSchema } from './update-building.dto.js';
import type { UpdateBuildingDto } from './update-building.dto.js';
import { BuildingsService } from './buildings.service.js';

@Controller('api/v1/hostels/:hostelId/buildings')
@UseGuards(SessionAuthGuard)
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
  ) {
    return this.buildingsService.listForUser(user.id, hostelId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Body({ schema: createBuildingSchema }) body: CreateBuildingDto,
  ) {
    return this.buildingsService.createForUser(user.id, hostelId, body);
  }

  @Patch(':buildingId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Body({ schema: updateBuildingSchema }) body: UpdateBuildingDto,
  ) {
    return this.buildingsService.updateForUser(user.id, hostelId, buildingId, body);
  }
}
