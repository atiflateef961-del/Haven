import { ConfigService } from '@nestjs/config';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

type NotificationScope = { organizationIds: string[]; global: boolean };

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async create(input: { userId: string; organizationId: string; title: string; body: string }) {
    const notification = await this.prisma.notification.create({
      data: input,
      select: { id: true, userId: true, organizationId: true, title: true, body: true, createdAt: true, user: { select: { email: true } } },
    });
    const delivery = await this.deliverEmail(notification.id, notification.title, notification.body, notification.user.email);
    return { ...notification, emailStatus: delivery.emailStatus, emailError: delivery.emailError };
  }

  async listForUser(userId: string) {
    const scope = await this.getScope(userId);
    const organizationIds = scope.global
      ? (await this.prisma.organization.findMany({ where: { archivedAt: null }, select: { id: true } })).map((item) => item.id)
      : scope.organizationIds;
    if (organizationIds.length === 0) return { notifications: [] };
    const notifications = await this.prisma.notification.findMany({
      where: { userId, organizationId: { in: organizationIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 50,
      select: { id: true, organizationId: true, title: true, body: true, status: true, readAt: true, emailStatus: true, createdAt: true },
    });
    return { notifications };
  }

  async markReadForUser(userId: string, notificationId: string) {
    const scope = await this.getScope(userId);
    const organizationIds = scope.global
      ? (await this.prisma.organization.findMany({ where: { archivedAt: null }, select: { id: true } })).map((item) => item.id)
      : scope.organizationIds;
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, organizationId: { in: organizationIds }, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const existing = await this.prisma.notification.findFirst({
        where: { id: notificationId, userId, organizationId: { in: organizationIds } }, select: { id: true, readAt: true },
      });
      if (!existing) throw new NotFoundException('Notification not found');
      return existing;
    }
    return this.prisma.notification.findFirst({
      where: { id: notificationId, userId, organizationId: { in: organizationIds } },
      select: { id: true, readAt: true },
    });
  }

  async listEmailFailuresForAdmin(userId: string) {
    const scope = await this.getScope(userId);
    const roles = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'ACCOUNTANT'] } } },
      select: { role: { select: { name: true } } },
    });
    if (!scope.global && roles.length === 0) throw new ForbiddenException('Email delivery reports require an administrator role');
    const organizationIds = scope.global
      ? (await this.prisma.organization.findMany({ where: { archivedAt: null }, select: { id: true } })).map((item) => item.id)
      : scope.organizationIds;
    if (organizationIds.length === 0) return { failures: [] };
    const failures = await this.prisma.notification.findMany({
      where: { organizationId: { in: organizationIds }, emailStatus: 'FAILED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 50,
      select: { id: true, organizationId: true, userId: true, title: true, emailError: true, createdAt: true, user: { select: { email: true } } },
    });
    return { failures };
  }

  async sendEmailForAdmin(userId: string, notificationId: string) {
    const scope = await this.getScope(userId);
    const roles = await this.prisma.userRole.findMany({
      where: { userId, role: { name: { in: ['SUPER_ADMIN', 'HOSTEL_ADMIN', 'ACCOUNTANT'] } } },
      select: { role: { select: { name: true } } },
    });
    if (!scope.global && roles.length === 0) throw new ForbiddenException('Email delivery requires an administrator role');
    const organizationIds = scope.global
      ? (await this.prisma.organization.findMany({ where: { archivedAt: null }, select: { id: true } })).map((item) => item.id)
      : scope.organizationIds;
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, organizationId: { in: organizationIds } },
      select: { id: true, title: true, body: true, user: { select: { email: true } } },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    return this.deliverEmail(notification.id, notification.title, notification.body, notification.user.email);
  }

  private async deliverEmail(notificationId: string, title: string, body: string, recipient: string) {
    const apiKey = this.config.get<string>('EMAIL_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');
    const endpoint = this.config.get<string>('EMAIL_API_URL') ?? 'https://api.resend.com/emails';
    if (!apiKey || !from) return this.prisma.notification.update({
      where: { id: notificationId },
      data: { emailStatus: 'FAILED', emailSentAt: null, emailError: 'Email provider is not configured' },
      select: { id: true, emailStatus: true, emailError: true },
    });
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `notification/${notificationId}` },
        body: JSON.stringify({ from, to: [recipient], subject: title, text: body }),
      });
      if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
      return this.prisma.notification.update({
        where: { id: notificationId },
        data: { emailStatus: 'SENT', emailSentAt: new Date(), emailError: null },
        select: { id: true, emailStatus: true, emailSentAt: true, emailError: true },
      });
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('Email provider returned HTTP ')
        ? error.message
        : 'Email provider delivery failed';
      return this.prisma.notification.update({
        where: { id: notificationId },
        data: { emailStatus: 'FAILED', emailSentAt: null, emailError: message },
        select: { id: true, emailStatus: true, emailError: true },
      });
    }
  }

  private async getScope(userId: string): Promise<NotificationScope> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { organizationId: true, role: { select: { name: true } }, hostel: { select: { organizationId: true } } },
    });
    const global = roles.some((item) => item.role.name === 'SUPER_ADMIN' && item.organizationId === null && !item.hostel);
    const organizationIds = new Set<string>();
    for (const role of roles) {
      const organizationId = role.organizationId ?? role.hostel?.organizationId;
      if (organizationId) organizationIds.add(organizationId);
    }
    const student = await this.prisma.student.findFirst({
      where: { userId, archivedAt: null, organization: { archivedAt: null } }, select: { organizationId: true },
    });
    if (student) organizationIds.add(student.organizationId);
    return { organizationIds: [...organizationIds], global };
  }
}
