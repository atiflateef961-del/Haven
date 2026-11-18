import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { PasswordHasher } from './password-hasher.service.js';

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export interface NewPasswordResetToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string): Promise<NewPasswordResetToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async requestReset(email: string): Promise<{ status: 'accepted'; message: string }> {
    const startedAt = Date.now();
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, status: true },
    });
    if (user?.status === 'ACTIVE') {
      const issued = await this.create(user.id);
      void this.deliverResetEmail(user.email, issued.token).catch(() => undefined);
    } else {
      await this.passwordHasher.hash(randomBytes(24).toString('base64url'));
    }
    const remaining = 300 - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    return { status: 'accepted', message: 'If the account exists, password reset instructions will be sent.' };
  }

  private async deliverResetEmail(email: string, token: string): Promise<void> {
    const apiKey = this.config.get<string>('EMAIL_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');
    const origin = this.config.get<string>('WEB_ORIGIN');
    const endpoint = this.config.get<string>('EMAIL_API_URL') ?? 'https://api.resend.com/emails';
    if (!apiKey || !from || !origin) return;
    await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Password reset instructions',
        text: `Use this one-time link within 15 minutes: ${origin}/reset-password?token=${encodeURIComponent(token)}`,
      }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const reset = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true, userId: true },
    });

    if (!reset) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);

    await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: reset.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException('Invalid or expired password reset token');
      }

      await transaction.passwordResetToken.updateMany({
        where: { userId: reset.userId, id: { not: reset.id }, consumedAt: null },
        data: { consumedAt: now },
      });
      await transaction.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      });
      await transaction.session.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
