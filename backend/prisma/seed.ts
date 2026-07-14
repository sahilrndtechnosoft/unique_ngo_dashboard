import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  PrismaClient,
  seller_status,
  user_role,
  user_status,
} from '../generated/prisma/client';
import { assignSuperAdminRole, seedRbac } from './seed-rbac';

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
        mobile: ADMIN_MOBILE,
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

async function seedSeller(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(SELLER_PASSWORD, BCRYPT_ROUNDS);
  const email = SELLER_EMAIL.toLowerCase();

  let user = await prisma.users.findFirst({
    where: { email, deleted_at: null },
  });

  if (user) {
    user = await prisma.users.update({
      where: { id: user.id },
      data: {
        full_name: SELLER_FULL_NAME,
        role: user_role.SELLER,
        status: user_status.ACTIVE,
        email_verified: true,
        mobile_verified: true,
        password_hash: passwordHash,
        mobile: SELLER_MOBILE,
      },
    });
    console.log(`Seller user updated: ${email}`);
  } else {
    user = await prisma.users.create({
      data: {
        full_name: SELLER_FULL_NAME,
        email,
        mobile: SELLER_MOBILE,
        password_hash: passwordHash,
        role: user_role.SELLER,
        status: user_status.ACTIVE,
        email_verified: true,
        mobile_verified: true,
      },
    });
    console.log(`Seller user created: ${email}`);
  }

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
  const passwordHash = await bcrypt.hash(USER_PASSWORD, BCRYPT_ROUNDS);
  const email = USER_EMAIL.toLowerCase();

  const existing = await prisma.users.findFirst({
    where: { email, deleted_at: null },
  });

  if (existing) {
    await prisma.users.update({
      where: { id: existing.id },
      data: {
        full_name: USER_FULL_NAME,
        role: user_role.USER,
        status: user_status.ACTIVE,
        email_verified: true,
        mobile_verified: true,
        password_hash: passwordHash,
        mobile: USER_MOBILE,
      },
    });
    console.log(`User updated: ${email}`);
    return;
  }

  await prisma.users.create({
    data: {
      full_name: USER_FULL_NAME,
      email,
      mobile: USER_MOBILE,
      password_hash: passwordHash,
      role: user_role.USER,
      status: user_status.ACTIVE,
      email_verified: true,
      mobile_verified: true,
    },
  });

  console.log(`User created: ${email}`);
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

    console.log('\n--- Admin login ---');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  Mobile:   ${ADMIN_MOBILE}`);
    console.log('  POST /api/v1/auth/admin/login');
    console.log('  POST /api/v1/auth/admin/send-otp');

    console.log('\n--- Seller login ---');
    console.log(`  Email:    ${SELLER_EMAIL}`);
    console.log(`  Password: ${SELLER_PASSWORD}`);
    console.log(`  Mobile:   ${SELLER_MOBILE}`);
    console.log('  POST /api/v1/auth/seller/login');
    console.log('  POST /api/v1/auth/seller/send-otp');

    console.log('\n--- User login ---');
    console.log(`  Email:    ${USER_EMAIL}`);
    console.log(`  Password: ${USER_PASSWORD}`);
    console.log(`  Mobile:   ${USER_MOBILE}`);
    console.log('  POST /api/v1/auth/user/login');
    console.log('  POST /api/v1/auth/user/send-otp');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
