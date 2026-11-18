import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';

const apiDir = fileURLToPath(new URL('..', import.meta.url));
dotenv.config({ path: resolve(apiDir, '../../.env'), quiet: true });

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured in the local environment.`);
  return value;
}

function readConfiguration() {
  const email = requiredEnv('SUPER_ADMIN_EMAIL').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const firstName = requiredEnv('SUPER_ADMIN_FIRST_NAME');
  const lastName = requiredEnv('SUPER_ADMIN_LAST_NAME');
  const organizationName = requiredEnv('SUPER_ADMIN_ORGANIZATION_NAME');
  const organizationSlug = requiredEnv('SUPER_ADMIN_ORGANIZATION_SLUG').toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw new Error('SUPER_ADMIN_EMAIL must be a valid email address.');
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) {
    throw new Error('SUPER_ADMIN_PASSWORD must be between 12 and 1024 characters.');
  }
  if (firstName.length > 100 || lastName.length > 100 || organizationName.length > 160) {
    throw new Error('Configured administrator and organization names exceed the supported length.');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug) || organizationSlug.length > 80) {
    throw new Error('SUPER_ADMIN_ORGANIZATION_SLUG must be a lowercase URL-safe slug.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured.');

  return { email, password, firstName, lastName, organizationName, organizationSlug };
}

async function main() {
  const config = readConfiguration();
  const { PrismaClient } = await import(pathToFileURL(resolve(apiDir, 'dist/generated/prisma/client.js')));
  const { PasswordHasher } = await import(pathToFileURL(resolve(apiDir, 'dist/src/modules/auth/password-hasher.service.js')));
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const hasher = new PasswordHasher();

    await prisma.$transaction(async (tx) => {
      let organization = await tx.organization.findUnique({
        where: { slug: config.organizationSlug },
      });

      if (organization) {
        if (organization.name !== config.organizationName || organization.archivedAt) {
          throw new Error('The configured organization slug belongs to a different or archived organization.');
        }
      } else {
        organization = await tx.organization.create({
          data: { name: config.organizationName, slug: config.organizationSlug },
        });
      }

      let user = await tx.user.findFirst({
        where: { email: { equals: config.email, mode: 'insensitive' } },
      });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: config.email,
            passwordHash: await hasher.hash(config.password),
            firstName: config.firstName,
            lastName: config.lastName,
            status: 'ACTIVE',
          },
        });
      } else {
        const update = {};
        if (user.email !== config.email) update.email = config.email;
        if (user.status !== 'ACTIVE') update.status = 'ACTIVE';
        if (!user.passwordHash) update.passwordHash = await hasher.hash(config.password);
        if (Object.keys(update).length > 0) {
          user = await tx.user.update({ where: { id: user.id }, data: update });
        }
      }

      const role = await tx.role.findFirst({
        where: { name: 'SUPER_ADMIN', organizationId: organization.id },
      }) ?? await tx.role.create({
        data: {
          name: 'SUPER_ADMIN',
          description: 'Organization-wide Super Admin access',
          organizationId: organization.id,
        },
      });

      await tx.membership.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
        create: { organizationId: organization.id, userId: user.id },
        update: {},
      });

      const assignment = await tx.userRole.findFirst({
        where: {
          userId: user.id,
          roleId: role.id,
          organizationId: organization.id,
          hostelId: null,
        },
      });
      if (!assignment) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: role.id, organizationId: organization.id },
        });
      }

      const permissions = await tx.permission.findMany({ select: { id: true } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map(({ id }) => ({ roleId: role.id, permissionId: id })),
          skipDuplicates: true,
        });
      }
    });

    process.stdout.write('Super Admin bootstrap completed for the configured organization.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const safeMessage = error instanceof Error && !/Prisma|Unique constraint|database/i.test(error.message)
    ? error.message
    : 'Super Admin bootstrap failed. Check database connectivity, migrations, and configured values.';
  process.stderr.write(`${safeMessage}\n`);
  process.exitCode = 1;
});
