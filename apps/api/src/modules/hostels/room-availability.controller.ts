import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { hostelIdSchema } from './update-hostel.dto.js';
import { RoomsService } from './rooms.service.js';

@Controller('api/v1/hostels/:hostelId/rooms/availability')
@UseGuards(SessionAuthGuard)
export class RoomAvailabilityController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('hostelId', { schema: hostelIdSchema }) hostelId: string) {
    return this.roomsService.listAvailabilityForUser(user.id, hostelId);
  }
}
