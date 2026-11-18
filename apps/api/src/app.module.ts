import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { environmentSchema } from './config/environment.schema.js';
import { PrismaModule } from './database/prisma.module.js';
import { HealthController } from './health.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { HostelsModule } from './modules/hostels/hostels.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { BookingsModule } from './modules/bookings/bookings.module.js';
import { FinanceModule } from './modules/finance/finance.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validationSchema: environmentSchema,
    }),
    PrismaModule,
    AuthModule,
    DashboardModule,
    HostelsModule,
    StudentsModule,
    BookingsModule,
    FinanceModule,
    NotificationsModule,
    OperationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
