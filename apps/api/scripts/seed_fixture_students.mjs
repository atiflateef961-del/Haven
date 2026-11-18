import { randomInt, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '../dist/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const apiDir = fileURLToPath(new URL('..', import.meta.url));
dotenv.config({ path: resolve(apiDir, '../../.env'), quiet: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const fixturePath = resolve(apiDir, '../../scripts/fixtures/pakistani-students.json');
const sourceRows = JSON.parse(await readFile(fixturePath, 'utf8'));
const expectedStatusCounts = {
  Active: 38,
  Probation: 20,
  Suspended: 14,
  'Leave of Absence': 14,
  Graduated: 14,
};
const statusMap = {
  Active: 'ACTIVE',
  Probation: 'PROBATION',
  Suspended: 'SUSPENDED',
  'Leave of Absence': 'LEAVE_OF_ABSENCE',
  Graduated: 'GRADUATED',
};
const requiredKeys = [
  'student_id', 'full_name', 'father_name', 'date_of_birth', 'gender',
  'grade_year', 'major', 'email', 'phone', 'cnic', 'home_address',
  'profile_photo_url', 'bio', 'enrollment_date', 'status',
];
const identityKeys = ['student_id', 'email', 'phone', 'cnic'];

if (!Array.isArray(sourceRows) || sourceRows.length !== 100) {
  throw new Error('Expected exactly 100 fixture rows');
}
for (const field of identityKeys) {
  if (new Set(sourceRows.map((row) => row[field])).size !== 100) {
    throw new Error(`Fixture ${field} values must be unique`);
  }
}
const observedStatusCounts = Object.fromEntries(Object.keys(expectedStatusCounts).map((label) => [
  label,
  sourceRows.filter((row) => row.status === label).length,
]));
if (JSON.stringify(observedStatusCounts) !== JSON.stringify(expectedStatusCounts)) {
  throw new Error('Fixture status distribution changed; inspect before seeding');
}
for (const [index, row] of sourceRows.entries()) {
  if (requiredKeys.some((key) => typeof row[key] !== 'string' || !row[key].trim())) {
    throw new Error(`Fixture row ${index + 1} (${row.student_id ?? 'unknown'}) has a missing field`);
  }
  if (!statusMap[row.status]) {
    throw new Error(`Fixture row ${index + 1} (${row.student_id}) has unsupported status ${row.status}`);
  }
  if (row.full_name.trim().split(/\s+/).length !== 2) {
    throw new Error(`Fixture row ${index + 1} (${row.student_id}) requires name-split review`);
  }
}

const organizationName = 'QA Test University (Do Not Use In Production)';
const organizationSlug = 'qa-test-university-do-not-use-production';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const dateOnly = (value) => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value).slice(0, 10);

try {
  const result = await prisma.$transaction(async (tx) => {
    let organization = await tx.organization.findUnique({ where: { slug: organizationSlug } });
    if (organization && (organization.name !== organizationName || organization.archivedAt)) {
      throw new Error('QA organization slug exists with unexpected or archived data');
    }
    if (!organization) {
      organization = await tx.organization.create({
        data: { name: organizationName, slug: organizationSlug, timezone: 'UTC' },
      });
    }

    for (const [index, row] of sourceRows.entries()) {
      const [firstName, lastName] = row.full_name.trim().split(/\s+/);
      try {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "Student" (
            "id", "organizationId", "userId", "studentNumber", "firstName", "lastName",
            "email", "phone", "dateOfBirth", "educationInstitution", "educationProgram",
            "educationYear", "status", "source_status", "fatherName", "gender", "nationalId",
            "homeAddress", "profilePhotoUrl", "bio", "enrollmentDate", "archivedAt",
            "createdAt", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${organization.id}, NULL, ${row.student_id}, ${firstName}, ${lastName},
            ${row.email}, ${row.phone}, ${row.date_of_birth}::date, NULL, ${row.major},
            ${row.grade_year}, ${statusMap[row.status]}::"StudentStatus", ${row.status},
            ${row.father_name}, ${row.gender}, ${row.cnic}, ${row.home_address},
            ${row.profile_photo_url}, ${row.bio}, ${row.enrollment_date}::date, NULL,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("studentNumber", "email", "phone", "nationalId") DO NOTHING
        `);
      } catch (error) {
        const reason = String(error?.message ?? 'database insert failed')
          .replace(/postgres(?:ql)?:\/\/\S+/gi, '[database URL redacted]')
          .replace(/(password|token|secret)=\S+/gi, '$1=[redacted]');
        throw new Error(`Fixture row ${index + 1} (${row.student_id}) failed: ${reason}`, { cause: error });
      }
    }

    const studentNumbers = sourceRows.map((row) => row.student_id);
    const savedRows = await tx.$queryRaw(Prisma.sql`
      SELECT * FROM "Student"
      WHERE "organizationId" = ${organization.id}
        AND "studentNumber" IN (${Prisma.join(studentNumbers)})
      ORDER BY "studentNumber"
    `);
    if (savedRows.length !== 100) {
      throw new Error(`QA organization has ${savedRows.length} fixture rows; expected 100`);
    }

    const byStudentNumber = new Map(savedRows.map((row) => [row.studentNumber, row]));
    const sampleIndexes = new Set();
    while (sampleIndexes.size < 3) sampleIndexes.add(randomInt(sourceRows.length));
    for (const index of sampleIndexes) {
      const source = sourceRows[index];
      const [firstName, lastName] = source.full_name.trim().split(/\s+/);
      const saved = byStudentNumber.get(source.student_id);
      const comparisons = [
        [saved?.studentNumber, source.student_id],
        [saved?.firstName, firstName],
        [saved?.lastName, lastName],
        [dateOnly(saved?.dateOfBirth), source.date_of_birth],
        [saved?.gender, source.gender],
        [saved?.educationYear, source.grade_year],
        [saved?.educationProgram, source.major],
        [saved?.email, source.email],
        [saved?.phone, source.phone],
        [saved?.nationalId, source.cnic],
        [saved?.fatherName, source.father_name],
        [saved?.homeAddress, source.home_address],
        [saved?.profilePhotoUrl, source.profile_photo_url],
        [saved?.bio, source.bio],
        [dateOnly(saved?.enrollmentDate), source.enrollment_date],
        [saved?.status, statusMap[source.status]],
        [saved?.source_status, source.status],
      ];
      if (comparisons.some(([actual, expected]) => actual !== expected)) {
        throw new Error(`Fixture row ${index + 1} (${source.student_id}) failed field round-trip verification`);
      }
    }
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      count: savedRows.length,
      sampleRows: [...sampleIndexes].map((index) => byStudentNumber.get(sourceRows[index].student_id)),
    };
  }, { timeout: 120_000 });

  process.stdout.write(`${JSON.stringify(result, (_, value) => value instanceof Date ? value.toISOString() : value, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
