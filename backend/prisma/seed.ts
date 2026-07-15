import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  PrismaClient,
  seller_status,
  user_role,
  user_status,
  users,
} from '../generated/prisma/client';
import { assignSuperAdminRole, seedRbac } from './seed-rbac';
import { printDemoCredentials, seedDemoData } from './seed-demo-data';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@unique-ngo.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME ?? 'Super Admin';
const ADMIN_MOBILE = process.env.ADMIN_MOBILE ?? '9999999999';
const ADMIN_ROLE = (process.env.ADMIN_ROLE ?? 'SUPER_ADMIN') as user_role;

const SELLER_EMAIL = process.env.SELLER_EMAIL ?? 'seller@unique-ngo.com';
const SELLER_PASSWORD = process.env.SELLER_PASSWORD ?? 'Seller@123456';
const SELLER_FULL_NAME = process.env.SELLER_FULL_NAME ?? 'Demo Seller';
const SELLER_MOBILE = process.env.SELLER_MOBILE ?? '9888888888';
const SELLER_BUSINESS = process.env.SELLER_BUSINESS ?? 'Demo Medical Store';

const USER_EMAIL = process.env.USER_EMAIL ?? 'sudhanshu@gmail.com';
const USER_PASSWORD = process.env.USER_PASSWORD ?? '12345678';
const USER_FULL_NAME = process.env.USER_FULL_NAME ?? 'Demo User';
const USER_MOBILE = process.env.USER_MOBILE ?? '9666666666';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

/** Find by email including soft-deleted rows (email unique still applies). */
async function findUserByEmail(prisma: PrismaClient, email: string) {
  return prisma.users.findFirst({
    where: { email },
  });
}

async function upsertSeedUser(
  prisma: PrismaClient,
  data: {
    email: string;
    fullName: string;
    mobile: string;
    password: string;
    role: user_role;
  },
): Promise<users> {
  const email = data.email.toLowerCase();
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const existing = await findUserByEmail(prisma, email);

  const isStaff =
    data.role === user_role.ADMIN || data.role === user_role.SUPER_ADMIN;

  if (existing) {
    return prisma.users.update({
      where: { id: existing.id },
      data: {
        full_name: data.fullName,
        role: data.role,
        status: user_status.ACTIVE,
        email_verified: true,
        mobile_verified: true,
        password_hash: passwordHash,
        mobile: data.mobile,
        deleted_at: null,
        // Staff rbac_role_id is assigned after seedRbac via assignSuperAdminRole
        ...(!isStaff ? { rbac_role_id: null } : {}),
      },
    });
  }

  return prisma.users.create({
    data: {
      full_name: data.fullName,
      email,
      mobile: data.mobile,
      password_hash: passwordHash,
      role: data.role,
      status: user_status.ACTIVE,
      email_verified: true,
      mobile_verified: true,
    },
  });
}

async function seedAdmin(prisma: PrismaClient) {
  const email = ADMIN_EMAIL.toLowerCase();
  const existing = await findUserByEmail(prisma, email);
  await upsertSeedUser(prisma, {
    email: ADMIN_EMAIL,
    fullName: ADMIN_FULL_NAME,
    mobile: ADMIN_MOBILE,
    password: ADMIN_PASSWORD,
    role: ADMIN_ROLE,
  });
  console.log(`Admin user ${existing ? 'updated' : 'created'}: ${email}`);
}

async function seedSeller(prisma: PrismaClient) {
  const email = SELLER_EMAIL.toLowerCase();
  const existing = await findUserByEmail(prisma, email);
  const user = await upsertSeedUser(prisma, {
    email: SELLER_EMAIL,
    fullName: SELLER_FULL_NAME,
    mobile: SELLER_MOBILE,
    password: SELLER_PASSWORD,
    role: user_role.SELLER,
  });
  console.log(`Seller user ${existing ? 'updated' : 'created'}: ${email}`);

  const existingProfile = await prisma.seller_profiles.findFirst({
    where: { user_id: user.id },
  });

  if (existingProfile) {
    await prisma.seller_profiles.update({
      where: { id: existingProfile.id },
      data: {
        business_name: SELLER_BUSINESS,
        status: seller_status.ACTIVE,
        deleted_at: null,
      },
    });
  } else {
    await prisma.seller_profiles.create({
      data: {
        user_id: user.id,
        business_name: SELLER_BUSINESS,
        description: 'Demo seller account for testing',
        status: seller_status.ACTIVE,
      },
    });
  }

  console.log(`Seller profile ready for: ${email}`);
}

async function seedUser(prisma: PrismaClient) {
  const email = USER_EMAIL.toLowerCase();
  const existing = await findUserByEmail(prisma, email);
  await upsertSeedUser(prisma, {
    email: USER_EMAIL,
    fullName: USER_FULL_NAME,
    mobile: USER_MOBILE,
    password: USER_PASSWORD,
    role: user_role.USER,
  });
  console.log(`User ${existing ? 'updated' : 'created'}: ${email}`);
}

async function seedAppSettings(prisma: PrismaClient) {
  await prisma.app_settings.upsert({
    where: { key: 'default' },
    create: {
      key: 'default',
      company_name: 'Unique NGO',
      tagline: 'Healthcare and social donation platform',
      email: 'contact@unique-ngo.com',
      phone: '9876543210',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      footer_about:
        'Unique NGO supports healthcare access, blood donation, and social welfare initiatives.',
      footer_copyright: '© Unique NGO. All rights reserved.',
      support_hours: 'Mon–Sat, 9 AM – 6 PM IST',
    },
    update: {
      company_name: 'Unique NGO',
      tagline: 'Healthcare and social donation platform',
    },
  });

  console.log('App settings ready');
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await seedRbac(prisma);
    await seedAdmin(prisma);
    await assignSuperAdminRole(prisma, ADMIN_EMAIL);
    await seedSeller(prisma);
    await seedUser(prisma);
    await seedAppSettings(prisma);
    await seedDemoData(prisma);

    console.log('\n--- Admin login ---');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  Mobile:   ${ADMIN_MOBILE}`);
    console.log('  POST /api/v1/auth/admin/login');

    console.log('\n--- Primary seller login ---');
    console.log(`  Email:    ${SELLER_EMAIL}`);
    console.log(`  Password: ${SELLER_PASSWORD}`);

    console.log('\n--- Primary user login ---');
    console.log(`  Email:    ${USER_EMAIL}`);
    console.log(`  Password: ${USER_PASSWORD}`);

    printDemoCredentials();
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
