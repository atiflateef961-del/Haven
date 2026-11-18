import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import { SessionService } from './session.service.js';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    PasswordResetService,
    SessionAuthGuard,
    SessionService,
  ],
  exports: [AuthService, PasswordHasher, PasswordResetService, SessionAuthGuard, SessionService],
})
export class AuthModule {}
