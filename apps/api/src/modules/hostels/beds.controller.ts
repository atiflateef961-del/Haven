import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { buildingIdSchema } from './update-building.dto.js';
import { floorIdSchema } from './update-floor.dto.js';
import { hostelIdSchema } from './update-hostel.dto.js';
import { roomIdSchema } from './update-room.dto.js';
import { createBedSchema } from './create-bed.dto.js';
import type { CreateBedDto } from './create-bed.dto.js';
import { bedIdSchema, updateBedSchema } from './update-bed.dto.js';
import type { UpdateBedDto } from './update-bed.dto.js';
import { BedsService } from './beds.service.js';

@Controller('api/v1/hostels/:hostelId/buildings/:buildingId/floors/:floorId/beds')
@UseGuards(SessionAuthGuard)
export class FloorBedsController {
  constructor(private readonly bedsService: BedsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Param('floorId', { schema: floorIdSchema }) floorId: string,
  ) {
    return this.bedsService.listForFloorForUser(user.id, hostelId, buildingId, floorId);
  }
}

@Controller('api/v1/hostels/:hostelId/buildings/:buildingId/floors/:floorId/rooms/:roomId/beds')
@UseGuards(SessionAuthGuard)
export class BedsController {
  constructor(private readonly bedsService: BedsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Param('floorId', { schema: floorIdSchema }) floorId: string,
    @Param('roomId', { schema: roomIdSchema }) roomId: string,
  ) {
    return this.bedsService.listForUser(user.id, hostelId, buildingId, floorId, roomId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Param('floorId', { schema: floorIdSchema }) floorId: string,
    @Param('roomId', { schema: roomIdSchema }) roomId: string,
    @Body({ schema: createBedSchema }) body: CreateBedDto,
  ) {
    return this.bedsService.createForUser(user.id, hostelId, buildingId, floorId, roomId, body);
  }

  @Patch(':bedId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Param('floorId', { schema: floorIdSchema }) floorId: string,
    @Param('roomId', { schema: roomIdSchema }) roomId: string,
    @Param('bedId', { schema: bedIdSchema }) bedId: string,
    @Body({ schema: updateBedSchema }) body: UpdateBedDto,
  ) {
    return this.bedsService.updateForUser(user.id, hostelId, buildingId, floorId, roomId, bedId, body);
  }
}
