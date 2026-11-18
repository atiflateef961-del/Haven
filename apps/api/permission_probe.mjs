import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './dist/generated/prisma/client.js';

dotenv.config({ path: '../../.env', quiet: true });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  const result = await prisma.$queryRaw`
    SELECT current_user AS role, table_name,
      string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
    FROM information_schema.role_table_grants
    WHERE grantee = current_user AND table_schema = 'public'
    GROUP BY current_user, table_name ORDER BY table_name
  `;
  console.log(JSON.stringify(result, null, 2));
} finally { await prisma.$disconnect(); }
