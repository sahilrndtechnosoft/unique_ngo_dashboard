import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient, user_role, user_status } from '../generated/prisma/client';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@unique-ngo.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME ?? 'Super Admin';
const ADMIN_MOBILE = process.env.ADMIN_MOBILE ?? '9999999999';
const ADMIN_ROLE = (process.env.ADMIN_ROLE ?? 'SUPER_ADMIN') as user_role;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

async function seedAdmin(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
  const email = ADMIN_EMAIL.toLowerCase();

  const existing = await prisma.users.findFirst({
    where: { email, deleted_at: null },
  });

  if (existing) {
    await prisma.users.update({
      where: { id: existing.id },
      data: {
        full_name: ADMIN_FULL_NAME,
        role: ADMIN_ROLE,
        status: user_status.ACTIVE,
        email_verified: true,
        mobile_verified: true,
        password_hash: passwordHash,
        mobile: existing.mobile ?? ADMIN_MOBILE,
      },
    });

    console.log(`Admin user updated: ${email}`);
    return;
  }

  await prisma.users.create({
    data: {
      full_name: ADMIN_FULL_NAME,
      email,
      mobile: ADMIN_MOBILE,
      password_hash: passwordHash,
      role: ADMIN_ROLE,
      status: user_status.ACTIVE,
      email_verified: true,
      mobile_verified: true,
    },
  });

  console.log(`Admin user created: ${email}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await seedAdmin(prisma);
    console.log('\nAdmin login credentials:');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  Role:     ${ADMIN_ROLE}`);
    console.log('\nLogin via POST /api/v1/auth/login');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
