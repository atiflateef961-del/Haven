import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { studentsListSchema } from '../students/students-list.dto.js';
import type { StudentsListDto } from '../students/students-list.dto.js';
import { BookingsService } from './bookings.service.js';
import { approveBookingSchema, bookingIdSchema } from './approve-booking.dto.js';
import type { ApproveBookingDto } from './approve-booking.dto.js';
import { allocationEventSchema, allocationIdSchema, transferAllocationSchema } from './allocation-event.dto.js';
import type { AllocationEventDto, TransferAllocationDto } from './allocation-event.dto.js';

@Controller('api/v1/bookings')
@UseGuards(SessionAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query({ schema: studentsListSchema }) query: StudentsListDto,
  ) {
    return this.bookingsService.listForUser(user.id, query);
  }

  @Get(':bookingId/available-beds')
  listAvailableBeds(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', { schema: bookingIdSchema }) bookingId: string,
    @Query({ schema: studentsListSchema }) query: StudentsListDto,
  ) {
    return this.bookingsService.listAvailableBedsForUser(user.id, bookingId, query);
  }

  @Patch(':bookingId/approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', { schema: bookingIdSchema }) bookingId: string,
    @Body({ schema: approveBookingSchema }) body: ApproveBookingDto,
  ) {
    return this.bookingsService.approveForUser(user.id, bookingId, body);
  }

  @Patch(':bookingId/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId', { schema: bookingIdSchema }) bookingId: string,
  ) {
    return this.bookingsService.rejectForUser(user.id, bookingId);
  }

  @Patch('allocations/:allocationId/check-in')
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('allocationId', { schema: allocationIdSchema }) allocationId: string,
    @Body({ schema: allocationEventSchema }) body: AllocationEventDto,
  ) {
    return this.bookingsService.checkInForUser(user.id, allocationId, body);
  }

  @Patch('allocations/:allocationId/check-out')
  checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('allocationId', { schema: allocationIdSchema }) allocationId: string,
    @Body({ schema: allocationEventSchema }) body: AllocationEventDto,
  ) {
    return this.bookingsService.checkOutForUser(user.id, allocationId, body);
  }

  @Patch('allocations/:allocationId/transfer')
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('allocationId', { schema: allocationIdSchema }) allocationId: string,
    @Body({ schema: transferAllocationSchema }) body: TransferAllocationDto,
  ) {
    return this.bookingsService.transferForUser(user.id, allocationId, body);
  }
}
