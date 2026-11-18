import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { buildingIdSchema } from './update-building.dto.js';
import { createFloorSchema } from './create-floor.dto.js';
import type { CreateFloorDto } from './create-floor.dto.js';
import { floorIdSchema, updateFloorSchema } from './update-floor.dto.js';
import type { UpdateFloorDto } from './update-floor.dto.js';
import { hostelIdSchema } from './update-hostel.dto.js';
import { BuildingsService } from './buildings.service.js';

@Controller('api/v1/hostels/:hostelId/buildings/:buildingId/floors')
@UseGuards(SessionAuthGuard)
export class FloorsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
  ) {
    return this.buildingsService.listFloorsForUser(user.id, hostelId, buildingId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Body({ schema: createFloorSchema }) body: CreateFloorDto,
  ) {
    return this.buildingsService.createFloorForUser(user.id, hostelId, buildingId, body);
  }

  @Patch(':floorId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Param('floorId', { schema: floorIdSchema }) floorId: string,
    @Body({ schema: updateFloorSchema }) body: UpdateFloorDto,
  ) {
    return this.buildingsService.updateFloorForUser(user.id, hostelId, buildingId, floorId, body);
  }
}
