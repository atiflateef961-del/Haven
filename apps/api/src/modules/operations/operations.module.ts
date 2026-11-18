import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ComplaintsController, MaintenanceController, MessController, OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';
import { StaffManagementController } from './staff-management.controller.js';
import { StaffManagementService } from './staff-management.service.js';

@Module({ imports: [AuthModule, NotificationsModule], controllers: [OperationsController, ComplaintsController, MaintenanceController, MessController, StaffManagementController], providers: [OperationsService, StaffManagementService] })
export class OperationsModule {}
