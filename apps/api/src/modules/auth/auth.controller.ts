import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { passwordResetRequestSchema, passwordResetSchema } from './password-reset.dto.js';
import type { PasswordResetDto } from './password-reset.dto.js';
import type { PasswordResetRequestDto } from './password-reset.dto.js';
import { CurrentUser } from './current-user.decorator.js';
import { loginSchema } from './login.dto.js';
import type { LoginDto } from './login.dto.js';
import { registerSchema } from './register.dto.js';
import type { RegisterDto } from './register.dto.js';
import { SessionService } from './session.service.js';
import { SessionAuthGuard } from './session-auth.guard.js';
import type { AuthenticatedUser } from './auth.types.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly passwordResetService: PasswordResetService,
    private readonly config: ConfigService,
  ) {}

  private sessionCookieOptions() {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
      path: '/',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body({ schema: loginSchema }) credentials: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ userId: string }> {
    const session = await this.authService.authenticate(
      credentials.email,
      credentials.password,
    );

    response.cookie(SESSION_COOKIE_NAME, session.token, {
      ...this.sessionCookieOptions(),
      expires: session.expiresAt,
    });

    return { userId: session.userId };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async register(
    @Body({ schema: registerSchema }) registration: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ userId: string }> {
    const session = await this.authService.register(registration);
    response.cookie(SESSION_COOKIE_NAME, session.token, {
      ...this.sessionCookieOptions(),
      expires: session.expiresAt,
    });
    return { userId: session.userId };
  }

  @Post('password-reset/complete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async completePasswordReset(
    @Body({ schema: passwordResetSchema }) reset: PasswordResetDto,
  ): Promise<{ status: 'ok' }> {
    await this.passwordResetService.resetPassword(reset.token, reset.newPassword);
    return { status: 'ok' };
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  requestPasswordReset(@Body({ schema: passwordResetRequestSchema }) request: PasswordResetRequestDto) {
    return this.passwordResetService.requestReset(request.email);
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Post('rotate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard, SessionAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async rotateSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: 'ok' }> {
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== 'string') {
      throw new UnauthorizedException();
    }

    const session = await this.sessionService.rotate(token);
    response.cookie(SESSION_COOKIE_NAME, session.token, {
      ...this.sessionCookieOptions(),
      expires: session.expiresAt,
    });

    return { status: 'ok' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: 'ok' }> {
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token === 'string') {
      await this.sessionService.revoke(token);
    }

    response.clearCookie(SESSION_COOKIE_NAME, {
      ...this.sessionCookieOptions(),
    });

    return { status: 'ok' };
  }
}
