import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface NewSession {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string): Promise<NewSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async rotate(token: string): Promise<NewSession> {
    const now = new Date();
    const replacement: NewSession = {
      token: randomBytes(32).toString('base64url'),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    };
    const oldTokenHash = this.hashToken(token);

    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.session.findFirst({
        where: {
          tokenHash: oldTokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
          lastSeenAt: { gt: new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS) },
          user: { status: 'ACTIVE' },
        },
        select: { id: true, userId: true },
      });

      if (!current) {
        throw new UnauthorizedException();
      }

      const revoked = await transaction.session.updateMany({
        where: {
          id: current.id,
          revokedAt: null,
          expiresAt: { gt: now },
          lastSeenAt: { gt: new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS) },
        },
        data: { revokedAt: now },
      });
      if (revoked.count !== 1) {
        throw new UnauthorizedException();
      }

      await transaction.session.create({
        data: {
          userId: current.userId,
          tokenHash: this.hashToken(replacement.token),
          expiresAt: replacement.expiresAt,
        },
      });

      return replacement;
    });
  }

  findActive(token: string) {
    return this.findAndTouchActive(token);
  }

  private async findAndTouchActive(token: string) {
    const now = new Date();
    const idleCutoff = new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS);
    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { gt: idleCutoff },
        user: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!session) {
      return null;
    }

    const touched = await this.prisma.session.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { gt: idleCutoff },
      },
      data: { lastSeenAt: now },
    });

    return touched.count === 1 ? session : null;
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
