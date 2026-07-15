import * as bcrypt from 'bcrypt';
import {
  PrismaClient,
  product_status,
  seller_status,
  user_role,
  user_status,
  users,
} from '../generated/prisma/client';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@123456';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

async function findUserByEmail(prisma: PrismaClient, email: string) {
  return prisma.users.findFirst({ where: { email: email.toLowerCase() } });
}

async function upsertUser(
  prisma: PrismaClient,
  data: {
    email: string;
    fullName: string;
    mobile: string;
    password: string;
    role: user_role;
    status?: user_status;
    rbacRoleSlug?: string | null;
  },
): Promise<users> {
  const email = data.email.toLowerCase();
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const existing = await findUserByEmail(prisma, email);
  const isStaff =
    data.role === user_role.ADMIN || data.role === user_role.SUPER_ADMIN;

  let rbacRoleId: string | null = null;
  if (isStaff && data.rbacRoleSlug) {
    const rbacRole = await prisma.roles.findUnique({
      where: { slug: data.rbacRoleSlug },
    });
    rbacRoleId = rbacRole?.id ?? null;
  }

  const shared = {
    full_name: data.fullName,
    role: data.role,
    status: data.status ?? user_status.ACTIVE,
    email_verified: true,
    mobile_verified: true,
    password_hash: passwordHash,
    mobile: data.mobile,
    deleted_at: null,
    rbac_role_id: isStaff ? rbacRoleId : null,
  };

  if (existing) {
    return prisma.users.update({
      where: { id: existing.id },
      data: shared,
    });
  }

  return prisma.users.create({
    data: {
      email,
      ...shared,
    },
  });
}

async function upsertSellerProfile(
  prisma: PrismaClient,
  userId: string,
  data: {
    businessName: string;
    businessType?: string;
    description?: string;
    status: seller_status;
    rejectionReason?: string | null;
  },
) {
  const existing = await prisma.seller_profiles.findFirst({
    where: { user_id: userId },
  });

  const payload = {
    business_name: data.businessName,
    business_type: data.businessType ?? null,
    description: data.description ?? null,
    status: data.status,
    rejection_reason: data.rejectionReason ?? null,
    deleted_at: null,
  };

  if (existing) {
    return prisma.seller_profiles.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return prisma.seller_profiles.create({
    data: {
      user_id: userId,
      ...payload,
    },
  });
}

/** Custom non-system role for assignment testing. */
async function seedCustomRoles(prisma: PrismaClient) {
  const support = await prisma.roles.upsert({
    where: { slug: 'support_agent' },
    create: {
      name: 'Support Agent',
      slug: 'support_agent',
      description: 'View users/sellers/products; edit tickets-style modules',
      is_system: false,
      is_active: true,
    },
    update: {
      name: 'Support Agent',
      description: 'View users/sellers/products; edit tickets-style modules',
      is_active: true,
    },
  });

  const viewModules = ['USERS', 'SELLERS', 'PRODUCTS', 'CATEGORIES'] as const;
  const permissions = await prisma.permissions.findMany({
    where: {
      OR: [
        { module: { in: [...viewModules] }, action: 'VIEW' },
        { module: 'PRODUCTS', action: 'EDIT' },
      ],
    },
  });

  for (const permission of permissions) {
    await prisma.role_permissions.upsert({
      where: {
        role_id_permission_id: {
          role_id: support.id,
          permission_id: permission.id,
        },
      },
      create: {
        role_id: support.id,
        permission_id: permission.id,
      },
      update: {},
    });
  }

  console.log(`Custom role ready: ${support.name} (${permissions.length} permissions)`);
  return support;
}

async function seedStaffUsers(prisma: PrismaClient) {
  const staff = [
    {
      email: 'staff.admin@unique-ngo.com',
      fullName: 'Priya Sharma',
      mobile: '9000000001',
      role: user_role.ADMIN,
      rbacRoleSlug: 'admin',
    },
    {
      email: 'staff.moderator@unique-ngo.com',
      fullName: 'Amit Verma',
      mobile: '9000000002',
      role: user_role.ADMIN,
      rbacRoleSlug: 'moderator',
    },
    {
      email: 'staff.support@unique-ngo.com',
      fullName: 'Neha Patel',
      mobile: '9000000003',
      role: user_role.ADMIN,
      rbacRoleSlug: 'support_agent',
    },
  ] as const;

  for (const row of staff) {
    await upsertUser(prisma, {
      ...row,
      password: DEMO_PASSWORD,
    });
  }

  console.log(`Staff users ready: ${staff.length}`);
}

async function seedAppUsers(prisma: PrismaClient) {
  const appUsers = [
    {
      email: 'user.active@unique-ngo.com',
      fullName: 'Ravi Kumar',
      mobile: '9100000001',
      status: user_status.ACTIVE,
    },
    {
      email: 'user.pending@unique-ngo.com',
      fullName: 'Sneha Iyer',
      mobile: '9100000002',
      status: user_status.PENDING_VERIFICATION,
    },
    {
      email: 'user.inactive@unique-ngo.com',
      fullName: 'Karan Mehta',
      mobile: '9100000003',
      status: user_status.INACTIVE,
    },
    {
      email: 'user.suspended@unique-ngo.com',
      fullName: 'Ananya Das',
      mobile: '9100000004',
      status: user_status.SUSPENDED,
    },
    {
      email: 'user.banned@unique-ngo.com',
      fullName: 'Vikram Singh',
      mobile: '9100000005',
      status: user_status.BANNED,
    },
    {
      email: 'donor.mumbai@unique-ngo.com',
      fullName: 'Meera Joshi',
      mobile: '9100000006',
      status: user_status.ACTIVE,
    },
    {
      email: 'donor.delhi@unique-ngo.com',
      fullName: 'Arjun Nair',
      mobile: '9100000007',
      status: user_status.ACTIVE,
    },
  ] as const;

  for (const row of appUsers) {
    await upsertUser(prisma, {
      email: row.email,
      fullName: row.fullName,
      mobile: row.mobile,
      password: DEMO_PASSWORD,
      role: user_role.USER,
      status: row.status,
    });
  }

  console.log(`App users ready: ${appUsers.length}`);
}

async function seedSellers(prisma: PrismaClient) {
  const sellers = [
    {
      email: 'seller.careplus@unique-ngo.com',
      fullName: 'Rohit Malhotra',
      mobile: '9200000001',
      businessName: 'CarePlus Pharmacy',
      businessType: 'Pharmacy',
      description: 'Retail pharmacy and OTC medical supplies',
      status: seller_status.ACTIVE,
    },
    {
      email: 'seller.medihub@unique-ngo.com',
      fullName: 'Pooja Reddy',
      mobile: '9200000002',
      businessName: 'MediHub Supplies',
      businessType: 'Medical Equipment',
      description: 'Hospital-grade equipment and disposables',
      status: seller_status.ACTIVE,
    },
    {
      email: 'seller.pending@unique-ngo.com',
      fullName: 'Suresh Pillai',
      mobile: '9200000003',
      businessName: 'GreenLife Wellness',
      businessType: 'Wellness',
      description: 'Awaiting document verification',
      status: seller_status.PENDING,
    },
    {
      email: 'seller.review@unique-ngo.com',
      fullName: 'Fatima Khan',
      mobile: '9200000004',
      businessName: 'Urban Aids Mart',
      businessType: 'Mobility Aids',
      description: 'Under compliance review',
      status: seller_status.UNDER_REVIEW,
    },
    {
      email: 'seller.suspended@unique-ngo.com',
      fullName: 'Deepak Rao',
      mobile: '9200000005',
      businessName: 'QuickMed Depot',
      businessType: 'Pharmacy',
      description: 'Temporarily suspended for policy review',
      status: seller_status.SUSPENDED,
    },
    {
      email: 'seller.rejected@unique-ngo.com',
      fullName: 'Ishita Ghosh',
      mobile: '9200000006',
      businessName: 'Failed Docs Store',
      businessType: 'General',
      description: 'Rejected due to incomplete KYC',
      status: seller_status.REJECTED,
      rejectionReason: 'GST / PAN documents incomplete',
    },
  ] as const;

  const profiles = [];
  for (const row of sellers) {
    const user = await upsertUser(prisma, {
      email: row.email,
      fullName: row.fullName,
      mobile: row.mobile,
      password: DEMO_PASSWORD,
      role: user_role.SELLER,
      status: user_status.ACTIVE,
    });
    const profile = await upsertSellerProfile(prisma, user.id, {
      businessName: row.businessName,
      businessType: row.businessType,
      description: row.description,
      status: row.status,
      rejectionReason: 'rejectionReason' in row ? row.rejectionReason : null,
    });
    profiles.push(profile);
  }

  console.log(`Sellers ready: ${sellers.length}`);
  return profiles;
}

async function seedCategories(prisma: PrismaClient) {
  const categories = [
    {
      name: 'Medicines',
      slug: 'medicines',
      description: 'Prescription and OTC medicines',
      sortOrder: 1,
      isFeatured: true,
    },
    {
      name: 'Medical Devices',
      slug: 'medical-devices',
      description: 'Diagnostic and monitoring devices',
      sortOrder: 2,
      isFeatured: true,
    },
    {
      name: 'Personal Care',
      slug: 'personal-care',
      description: 'Hygiene and personal care products',
      sortOrder: 3,
      isFeatured: false,
    },
    {
      name: 'First Aid',
      slug: 'first-aid',
      description: 'First aid kits and emergency supplies',
      sortOrder: 4,
      isFeatured: true,
    },
    {
      name: 'Mobility Aids',
      slug: 'mobility-aids',
      description: 'Wheelchairs, walkers, crutches',
      sortOrder: 5,
      isFeatured: false,
    },
    {
      name: 'Nutrition',
      slug: 'nutrition',
      description: 'Supplements and nutritional drinks',
      sortOrder: 6,
      isFeatured: false,
    },
    {
      name: 'Lab Equipment',
      slug: 'lab-equipment',
      description: 'Basic lab and testing consumables',
      sortOrder: 7,
      isFeatured: false,
      isActive: false,
    },
    {
      name: 'Home Healthcare',
      slug: 'home-healthcare',
      description: 'Home nursing and care accessories',
      sortOrder: 8,
      isFeatured: true,
    },
  ] as const;

  const rows = [];
  for (const category of categories) {
    const row = await prisma.product_categories.upsert({
      where: { slug: category.slug },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        sort_order: category.sortOrder,
        is_featured: category.isFeatured,
        is_active: 'isActive' in category ? category.isActive : true,
      },
      update: {
        name: category.name,
        description: category.description,
        sort_order: category.sortOrder,
        is_featured: category.isFeatured,
        is_active: 'isActive' in category ? category.isActive : true,
      },
    });
    rows.push(row);
  }

  console.log(`Categories ready: ${rows.length}`);
  return rows;
}

async function seedProducts(
  prisma: PrismaClient,
  sellerProfileIds: string[],
  categoryIds: string[],
) {
  if (!sellerProfileIds.length || !categoryIds.length) {
    console.log('Skipping products — missing sellers or categories');
    return;
  }

  const [primarySeller, secondarySeller] = [
    sellerProfileIds[0],
    sellerProfileIds[1] ?? sellerProfileIds[0],
  ];

  const products = [
    {
      slug: 'digital-bp-monitor',
      name: 'Digital Blood Pressure Monitor',
      description: 'Automatic arm-cuff BP monitor with memory storage for two users.',
      shortDescription: 'Accurate home BP monitoring',
      brand: 'CareSense',
      sku: 'DEV-BP-001',
      price: 1899,
      compareAtPrice: 2499,
      stock: 45,
      status: product_status.ACTIVE,
      sellerId: primarySeller,
      categorySlug: 'medical-devices',
      tags: ['bp', 'device', 'home'],
      featured: true,
    },
    {
      slug: 'pulse-oximeter',
      name: 'Fingertip Pulse Oximeter',
      description: 'SpO2 and pulse rate check with OLED display.',
      shortDescription: 'Compact SpO2 meter',
      brand: 'OxyLite',
      sku: 'DEV-OX-002',
      price: 799,
      compareAtPrice: 999,
      stock: 120,
      status: product_status.ACTIVE,
      sellerId: primarySeller,
      categorySlug: 'medical-devices',
      tags: ['oximeter', 'device'],
      featured: true,
    },
    {
      slug: 'first-aid-kit-family',
      name: 'Family First Aid Kit',
      description: '60-piece kit for home and travel emergencies.',
      shortDescription: 'Complete first aid assortment',
      brand: 'SafeKit',
      sku: 'AID-KIT-010',
      price: 599,
      compareAtPrice: 749,
      stock: 80,
      status: product_status.ACTIVE,
      sellerId: secondarySeller,
      categorySlug: 'first-aid',
      tags: ['first-aid', 'kit'],
      featured: false,
    },
    {
      slug: 'hand-sanitizer-500ml',
      name: 'Hand Sanitizer 500ml',
      description: '70% alcohol-based sanitizer with moisturizers.',
      shortDescription: 'Alcohol-based sanitizer',
      brand: 'CleanHands',
      sku: 'PC-SAN-500',
      price: 149,
      compareAtPrice: 199,
      stock: 300,
      status: product_status.ACTIVE,
      sellerId: primarySeller,
      categorySlug: 'personal-care',
      tags: ['sanitizer', 'hygiene'],
      featured: false,
    },
    {
      slug: 'protein-nutrition-shake',
      name: 'Protein Nutrition Shake (1kg)',
      description: 'High-protein nutrition supplement for recovery support.',
      shortDescription: 'Recovery nutrition shake',
      brand: 'NutriPlus',
      sku: 'NUT-PRO-1KG',
      price: 1299,
      compareAtPrice: 1599,
      stock: 60,
      status: product_status.PENDING_REVIEW,
      sellerId: secondarySeller,
      categorySlug: 'nutrition',
      tags: ['nutrition', 'protein'],
      featured: false,
    },
    {
      slug: 'folding-walker',
      name: 'Foldable Walking Frame',
      description: 'Lightweight aluminum walker with height adjustment.',
      shortDescription: 'Foldable walker for seniors',
      brand: 'MobiliCare',
      sku: 'MOB-WALK-01',
      price: 2499,
      compareAtPrice: 2999,
      stock: 25,
      status: product_status.PENDING_REVIEW,
      sellerId: secondarySeller,
      categorySlug: 'mobility-aids',
      tags: ['walker', 'mobility'],
      featured: false,
    },
    {
      slug: 'glucometer-kit',
      name: 'Blood Glucose Monitor Kit',
      description: 'Glucometer with 25 test strips and lancets.',
      shortDescription: 'Home glucose testing kit',
      brand: 'GlucoSure',
      sku: 'DEV-GLU-003',
      price: 999,
      compareAtPrice: 1299,
      stock: 0,
      status: product_status.OUT_OF_STOCK,
      sellerId: primarySeller,
      categorySlug: 'medical-devices',
      tags: ['diabetes', 'device'],
      featured: false,
    },
    {
      slug: 'surgical-mask-box',
      name: '3-Ply Surgical Masks (Box of 50)',
      description: 'Disposable 3-ply masks for daily protection.',
      shortDescription: 'Box of 50 masks',
      brand: 'ShieldWear',
      sku: 'PC-MASK-50',
      price: 249,
      compareAtPrice: 349,
      stock: 500,
      status: product_status.INACTIVE,
      sellerId: primarySeller,
      categorySlug: 'personal-care',
      tags: ['mask', 'ppe'],
      featured: false,
    },
    {
      slug: 'draft-thermometer',
      name: 'Infrared Thermometer (Draft)',
      description: 'Non-contact IR thermometer — draft listing for seller review.',
      shortDescription: 'Draft IR thermometer',
      brand: 'TempScan',
      sku: 'DEV-TMP-DRF',
      price: 1199,
      compareAtPrice: null,
      stock: 10,
      status: product_status.DRAFT,
      sellerId: secondarySeller,
      categorySlug: 'medical-devices',
      tags: ['thermometer', 'draft'],
      featured: false,
    },
    {
      slug: 'rejected-nebulizer',
      name: 'Portable Nebulizer (Rejected)',
      description: 'Compact nebulizer rejected due to incomplete certification.',
      shortDescription: 'Rejected nebulizer listing',
      brand: 'BreatheEasy',
      sku: 'DEV-NEB-REJ',
      price: 2199,
      compareAtPrice: 2699,
      stock: 8,
      status: product_status.REJECTED,
      sellerId: secondarySeller,
      categorySlug: 'home-healthcare',
      tags: ['nebulizer', 'rejected'],
      featured: false,
      rejectionReason: 'Missing medical device certification documents',
    },
    {
      slug: 'vitamin-d3-strips',
      name: 'Vitamin D3 Softgels (60)',
      description: 'Daily vitamin D3 softgels for bone and immunity support.',
      shortDescription: 'Vitamin D3 60 softgels',
      brand: 'VitaDaily',
      sku: 'NUT-VD3-60',
      price: 349,
      compareAtPrice: 449,
      stock: 150,
      status: product_status.ACTIVE,
      sellerId: primarySeller,
      categorySlug: 'nutrition',
      tags: ['vitamin', 'supplement'],
      featured: true,
    },
    {
      slug: 'home-care-bedside-rails',
      name: 'Adjustable Bedside Safety Rails',
      description: 'Pair of adjustable bedside rails for home patient safety.',
      shortDescription: 'Bedside safety rails',
      brand: 'HomeCare Pro',
      sku: 'HC-RAIL-02',
      price: 1799,
      compareAtPrice: 2199,
      stock: 18,
      status: product_status.ACTIVE,
      sellerId: secondarySeller,
      categorySlug: 'home-healthcare',
      tags: ['homecare', 'safety'],
      featured: false,
    },
  ] as const;

  const categoryBySlug = new Map(
    (
      await prisma.product_categories.findMany({
        where: { slug: { in: products.map((p) => p.categorySlug) } },
      })
    ).map((c) => [c.slug, c.id]),
  );

  let count = 0;
  for (const product of products) {
    const categoryId = categoryBySlug.get(product.categorySlug) ?? categoryIds[0];
    await prisma.products.upsert({
      where: { slug: product.slug },
      create: {
        seller_id: product.sellerId,
        category_id: categoryId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        short_description: product.shortDescription,
        brand: product.brand,
        sku: product.sku,
        status: product.status,
        price: product.price,
        compare_at_price: product.compareAtPrice,
        stock_quantity: product.stock,
        is_featured: product.featured,
        tags: [...product.tags],
        rejection_reason:
          'rejectionReason' in product ? product.rejectionReason : null,
      },
      update: {
        seller_id: product.sellerId,
        category_id: categoryId,
        name: product.name,
        description: product.description,
        short_description: product.shortDescription,
        brand: product.brand,
        sku: product.sku,
        status: product.status,
        price: product.price,
        compare_at_price: product.compareAtPrice,
        stock_quantity: product.stock,
        is_featured: product.featured,
        tags: [...product.tags],
        rejection_reason:
          'rejectionReason' in product ? product.rejectionReason : null,
        deleted_at: null,
      },
    });
    count += 1;
  }

  console.log(`Products ready: ${count}`);
}

async function seedBanners(prisma: PrismaClient) {
  const banners = [
    {
      title: 'Donate Blood, Save Lives',
      subtitle: 'Join our community blood donation camps',
      image_url: '/uploads/banners/blood-donation.jpg',
      link_url: '/donate',
      button_text: 'Donate Now',
      sort_order: 1,
      is_active: true,
    },
    {
      title: 'Healthcare Essentials',
      subtitle: 'Trusted medical products from verified sellers',
      image_url: '/uploads/banners/healthcare.jpg',
      link_url: '/products',
      button_text: 'Shop Now',
      sort_order: 2,
      is_active: true,
    },
    {
      title: 'Seller Spotlight',
      subtitle: 'Partner with Unique NGO marketplace',
      image_url: '/uploads/banners/sellers.jpg',
      link_url: '/sellers',
      button_text: 'Become a Seller',
      sort_order: 3,
      is_active: true,
    },
    {
      title: 'Seasonal Wellness Drive',
      subtitle: 'Inactive banner for sorting tests',
      image_url: '/uploads/banners/wellness.jpg',
      link_url: '/wellness',
      button_text: 'Learn More',
      sort_order: 4,
      is_active: false,
    },
  ];

  // Banner titles are not unique — upsert by sort_order + title via find/update.
  for (const banner of banners) {
    const existing = await prisma.banner_images.findFirst({
      where: { title: banner.title, deleted_at: null },
    });
    if (existing) {
      await prisma.banner_images.update({
        where: { id: existing.id },
        data: { ...banner, deleted_at: null },
      });
    } else {
      await prisma.banner_images.create({ data: banner });
    }
  }

  console.log(`Banners ready: ${banners.length}`);
}

export async function seedDemoData(prisma: PrismaClient) {
  await seedCustomRoles(prisma);
  await seedStaffUsers(prisma);
  await seedAppUsers(prisma);

  const sellerProfiles = await seedSellers(prisma);
  const categories = await seedCategories(prisma);

  // Prefer ACTIVE demo sellers for product ownership when available
  const activeSellerIds = sellerProfiles
    .filter((profile) => profile.status === seller_status.ACTIVE)
    .map((profile) => profile.id);
  const sellerIdsForProducts =
    activeSellerIds.length > 0
      ? activeSellerIds
      : sellerProfiles.map((profile) => profile.id);

  await seedProducts(
    prisma,
    sellerIdsForProducts,
    categories.map((category) => category.id),
  );
  await seedBanners(prisma);
}

export function printDemoCredentials() {
  console.log('\n--- Demo staff (dashboard) ---');
  console.log(`  Password for all demo accounts below: ${DEMO_PASSWORD}`);
  console.log('  staff.admin@unique-ngo.com     → ADMIN + Admin RBAC');
  console.log('  staff.moderator@unique-ngo.com → ADMIN + Moderator RBAC');
  console.log('  staff.support@unique-ngo.com   → ADMIN + Support Agent RBAC');

  console.log('\n--- Demo sellers (seller portal) ---');
  console.log('  seller.careplus@unique-ngo.com  ACTIVE');
  console.log('  seller.medihub@unique-ngo.com   ACTIVE');
  console.log('  seller.pending@unique-ngo.com   PENDING');
  console.log('  seller.review@unique-ngo.com    UNDER_REVIEW');
  console.log('  seller.suspended@unique-ngo.com SUSPENDED');
  console.log('  seller.rejected@unique-ngo.com  REJECTED');

  console.log('\n--- Demo app users (mobile) ---');
  console.log('  user.active@unique-ngo.com … user.banned@unique-ngo.com (+ donors)');
  console.log('  Also includes categories (8), products (12), banners (4), roles (+ Support Agent)');
}
