import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HostelsController } from './hostels.controller.js';
import { HostelsService } from './hostels.service.js';
import { BuildingsController } from './buildings.controller.js';
import { BuildingsService } from './buildings.service.js';
import { FloorsController } from './floors.controller.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';
import { BedsController, FloorBedsController } from './beds.controller.js';
import { BedsService } from './beds.service.js';
import { RoomAvailabilityController } from './room-availability.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [HostelsController, BuildingsController, FloorsController, RoomsController, BedsController, FloorBedsController, RoomAvailabilityController],
  providers: [HostelsService, BuildingsService, RoomsService, BedsService],
})
export class HostelsModule {}
