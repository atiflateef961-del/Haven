import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service.js';
import { PasswordHasher } from './password-hasher.service.js';
import { SessionService } from './session.service.js';
import type { RegisterDto } from './register.dto.js';

export interface AuthenticatedSession {
  userId: string;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionService: SessionService,
    private readonly config: ConfigService,
  ) {}

  async authenticate(
    email: string,
    password: string,
  ): Promise<AuthenticatedSession> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, passwordHash: true, status: true },
    });

    const passwordValid = user?.passwordHash
      ? await this.passwordHasher.verify(user.passwordHash, password)
      : await this.performDummyHash(password);

    if (!user || user.status !== 'ACTIVE' || !passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const session = await this.sessionService.create(user.id);
    return { userId: user.id, ...session };
  }

  async register(input: RegisterDto): Promise<AuthenticatedSession> {
    const email = input.email.trim().toLowerCase();
    const normalizedName = input.fullName.trim().replace(/\s+/g, ' ');
    const splitAt = normalizedName.lastIndexOf(' ');
    const firstName = (splitAt < 0 ? normalizedName : normalizedName.slice(0, splitAt)).slice(0, 100);
    const lastName = (splitAt < 0 ? normalizedName : normalizedName.slice(splitAt + 1)).slice(0, 100);
    const passwordHash = await this.passwordHasher.hash(input.password);
    const roleName = this.config.get<string>('DEFAULT_SIGNUP_ROLE', 'HOSTEL_ADMIN');

    try {
      const user = await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { id: true },
        });
        if (existing) throw new ConflictException('Email is already registered');

        const organization = await transaction.organization.create({
          data: {
            name: `${normalizedName.slice(0, 145)}'s Hostel`,
            slug: `signup-${randomUUID()}`,
          },
        });
        const createdUser = await transaction.user.create({
          data: { email, passwordHash, firstName, lastName, status: 'ACTIVE' },
        });
        await transaction.membership.create({
          data: { organizationId: organization.id, userId: createdUser.id },
        });

        const role = await transaction.role.create({
          data: {
            name: roleName,
            description: roleName === 'HOSTEL_ADMIN'
              ? 'Organization-wide access for the organization owner'
              : 'Finance access for the organization owner',
            organizationId: organization.id,
          },
        });
        if (roleName === 'HOSTEL_ADMIN') {
          const permissions = await transaction.permission.findMany({ select: { id: true } });
          if (permissions.length > 0) {
            await transaction.rolePermission.createMany({
              data: permissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
              skipDuplicates: true,
            });
          }
        }
        await transaction.userRole.create({
          data: { userId: createdUser.id, roleId: role.id, organizationId: organization.id },
        });
        return createdUser;
      });

      const session = await this.sessionService.create(user.id);
      return { userId: user.id, ...session };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  private async performDummyHash(password: string): Promise<false> {
    await this.passwordHasher.hash(password);
    return false;
  }
}
