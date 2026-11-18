import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('api/v1/notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.listForUser(user.id);
  }

  @Patch(':notificationId/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('notificationId', { schema: z.uuid() }) notificationId: string) {
    return this.notifications.markReadForUser(user.id, notificationId);
  }

  @Get('email-failures')
  emailFailures(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.listEmailFailuresForAdmin(user.id);
  }

  @Post(':notificationId/email')
  sendEmail(@CurrentUser() user: AuthenticatedUser, @Param('notificationId', { schema: z.uuid() }) notificationId: string) {
    return this.notifications.sendEmailForAdmin(user.id, notificationId);
  }
}
