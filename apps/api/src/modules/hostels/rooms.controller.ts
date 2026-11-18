import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { buildingIdSchema } from './update-building.dto.js';
import { createRoomSchema } from './create-room.dto.js';
import type { CreateRoomDto } from './create-room.dto.js';
import { floorIdSchema } from './update-floor.dto.js';
import { hostelIdSchema } from './update-hostel.dto.js';
import { roomIdSchema, updateRoomSchema } from './update-room.dto.js';
import type { UpdateRoomDto } from './update-room.dto.js';
import { RoomsService } from './rooms.service.js';

@Controller('api/v1/hostels/:hostelId/buildings/:buildingId/floors/:floorId/rooms')
@UseGuards(SessionAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Param('floorId', { schema: floorIdSchema }) floorId: string,
  ) {
    return this.roomsService.listForUser(user.id, hostelId, buildingId, floorId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Param('floorId', { schema: floorIdSchema }) floorId: string,
    @Body({ schema: createRoomSchema }) body: CreateRoomDto,
  ) {
    return this.roomsService.createForUser(user.id, hostelId, buildingId, floorId, body);
  }

  @Patch(':roomId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Param('floorId', { schema: floorIdSchema }) floorId: string,
    @Param('roomId', { schema: roomIdSchema }) roomId: string,
    @Body({ schema: updateRoomSchema }) body: UpdateRoomDto,
  ) {
    return this.roomsService.updateForUser(user.id, hostelId, buildingId, floorId, roomId, body);
  }

  @Post(':roomId/archive')
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hostelId', { schema: hostelIdSchema }) hostelId: string,
    @Param('buildingId', { schema: buildingIdSchema }) buildingId: string,
    @Param('floorId', { schema: floorIdSchema }) floorId: string,
    @Param('roomId', { schema: roomIdSchema }) roomId: string,
  ) {
    return this.roomsService.archiveForUser(user.id, hostelId, buildingId, floorId, roomId);
  }
}
